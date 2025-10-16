import Mnee from 'mnee';
import assert from 'assert';
import testConfig from '../testConfig.js';

// Test configuration
const config = {
  environment: testConfig.environment,
  apiKey: testConfig.apiKey,
};

const mnee = new Mnee(config);

// Test to reproduce duplicate transaction issue
async function testDuplicateTransactions() {
  try {
    // These addresses may have interacted with each other
    const addresses = [
      testConfig.addresses.testAddress,
      '1ERN5r4A8Ur6T4XQgaxQLmWtRAmusga5xZ',
      '159zQuZRmHUrZArYTFgogQxndrAeSsbTtJ',
    ];

    console.log('Testing with addresses that may have interacted:');
    addresses.forEach((addr, i) => console.log(`  ${i + 1}. ${addr}`));
    console.log();

    // First, get individual histories
    console.log('Step 1: Getting individual histories...');
    const individualHistories = new Map();
    const individualTxIds = new Map();

    for (const address of addresses) {
      const history = await mnee.recentTxHistory(address, undefined, 10000);
      individualHistories.set(address, history);
      individualTxIds.set(address, new Set(history.history.map(tx => tx.txid)));
      console.log(`  ${address}: ${history.history.length} transactions`);
    }

    // Now get batch histories with default order
    console.log('\nStep 2: Getting batch histories...');
    const params = addresses.map(address => ({ address, limit: 10000 }));
    const batchHistories = await mnee.recentTxHistories(params);
    
    // Test with different order parameters
    console.log('\nStep 2b: Testing with order parameters...');
    const ascParams = addresses.map(address => ({ address, limit: 10000, order: 'asc' }));
    const ascBatchHistories = await mnee.recentTxHistories(ascParams);
    
    const descParams = addresses.map(address => ({ address, limit: 10000, order: 'desc' }));
    const descBatchHistories = await mnee.recentTxHistories(descParams);
    
    // Verify order affects results
    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      const ascHistory = ascBatchHistories[i];
      const descHistory = descBatchHistories[i];
      
      if (ascHistory.history.length > 1 && descHistory.history.length > 1) {
        const firstAscTxid = ascHistory.history[0].txid;
        const firstDescTxid = descHistory.history[0].txid;
        
        if (firstAscTxid !== firstDescTxid) {
          console.log(`  ${address}: Different first transaction with asc/desc order ✓`);
        }
        
        // Verify score ordering
        const ascScores = ascHistory.history.map(tx => tx.score);
        const descScores = descHistory.history.map(tx => tx.score);
        
        let ascOrdered = true;
        let descOrdered = true;
        
        for (let j = 1; j < ascScores.length; j++) {
          if (ascScores[j] < ascScores[j-1]) ascOrdered = false;
        }
        
        for (let j = 1; j < descScores.length; j++) {
          if (descScores[j] > descScores[j-1]) descOrdered = false;
        }
        
        if (ascOrdered && descOrdered) {
          console.log(`  ${address}: Scores properly ordered (asc: ${ascOrdered}, desc: ${descOrdered}) ✓`);
        }
      }
    }

    // Compare results
    console.log('\nStep 3: Comparing results...');
    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      const individualHistory = individualHistories.get(address);
      const batchHistory = batchHistories[i];

      console.log(`\nAddress: ${address}`);
      console.log(`  Individual API: ${individualHistory.history.length} transactions`);
      console.log(`  Batch API: ${batchHistory.history.length} transactions`);

      if (individualHistory.history.length !== batchHistory.history.length) {
        console.log(`  ⚠️  MISMATCH: Different number of transactions!`);
      }

      // Check for exact same transactions
      const individualSet = individualTxIds.get(address);
      const batchSet = new Set(batchHistory.history.map(tx => tx.txid));

      const onlyInIndividual = [...individualSet].filter(txid => !batchSet.has(txid));
      const onlyInBatch = [...batchSet].filter(txid => !individualSet.has(txid));

      if (onlyInIndividual.length > 0) {
        console.log(`  Transactions only in individual: ${onlyInIndividual.join(', ')}`);
      }
      if (onlyInBatch.length > 0) {
        console.log(`  Transactions only in batch: ${onlyInBatch.join(', ')}`);
      }
    }

    // Check for duplicate transactions across addresses in batch result
    console.log('\nStep 4: Checking for duplicate transactions across addresses...');
    const allBatchTxIds = new Map();
    
    for (let i = 0; i < batchHistories.length; i++) {
      const address = addresses[i];
      const history = batchHistories[i];
      
      for (const tx of history.history) {
        if (!allBatchTxIds.has(tx.txid)) {
          allBatchTxIds.set(tx.txid, []);
        }
        allBatchTxIds.get(tx.txid).push({
          address,
          type: tx.type,
          amount: tx.amount,
        });
      }
    }

    // Find transactions that appear in multiple addresses
    const duplicates = [...allBatchTxIds.entries()]
      .filter(([_, appearances]) => appearances.length > 1);

    if (duplicates.length > 0) {
      console.log(`\n🔴 Found ${duplicates.length} transactions appearing in multiple addresses:`);
      
      for (const [txid, appearances] of duplicates.slice(0, 5)) { // Show first 5
        console.log(`\n  Transaction: ${txid}`);
        for (const app of appearances) {
          console.log(`    - ${app.address}: ${app.type} ${mnee.fromAtomicAmount(app.amount)} MNEE`);
        }
      }
    } else {
      console.log('\n✅ No duplicate transactions found across addresses');
    }

    // Additional check: Look for internal transfers
    console.log('\nStep 5: Checking for internal transfers between test addresses...');
    const addressSet = new Set(addresses);
    let internalTransfers = 0;

    for (const history of batchHistories) {
      for (const tx of history.history) {
        const hasInternalCounterparty = tx.counterparties.some(cp => addressSet.has(cp.address));
        if (hasInternalCounterparty) {
          internalTransfers++;
        }
      }
    }

    console.log(`  Found ${internalTransfers} transactions involving multiple test addresses`);

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
}

// Run the test
async function runTest() {
  console.log('Testing recentTxHistories duplicate transaction issue...\n');

  try {
    await mnee.config();
    await testDuplicateTransactions();
    console.log('\nTest completed.');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTest();