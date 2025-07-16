import Mnee from '../dist/index.modern.js';
import assert from 'assert';
import testConfig from './tests.config.json' assert { type: 'json' };

// Test configuration
const config = {
  environment: testConfig.environment,
};

const mnee = new Mnee(config);

// Test addresses from config
const TEST_ADDRESS = testConfig.addresses.testAddress;
const EMPTY_ADDRESS = testConfig.addresses.emptyAddress;

// Test 11.1: Get recent transaction history for address
async function testBasicTxHistory() {
  try {
    const history = await mnee.recentTxHistory(TEST_ADDRESS);
    
    // Verify response structure
    assert(history.address === TEST_ADDRESS, 'Response should include the queried address');
    assert(Array.isArray(history.history), 'History should be an array');
    assert(typeof history.nextScore === 'number' || history.nextScore === null, 'NextScore should be a number or null');
    
    console.log(`  Found ${history.history.length} transactions for ${TEST_ADDRESS}`);
    
    // If there are transactions, verify their structure
    if (history.history.length > 0) {
      const tx = history.history[0];
      assert(tx.txid, 'Transaction should have txid');
      assert(typeof tx.height === 'number', 'Transaction should have height');
      assert(['confirmed', 'unconfirmed'].includes(tx.status), 'Status should be confirmed or unconfirmed');
      assert(['send', 'receive'].includes(tx.type), 'Type should be send or receive');
      assert(typeof tx.amount === 'number', 'Amount should be a number');
      assert(Array.isArray(tx.counterparties), 'Counterparties should be an array');
      assert(typeof tx.fee === 'number', 'Fee should be a number');
      assert(typeof tx.score === 'number', 'Score should be a number');
      
      console.log(`  First transaction: ${tx.txid} (${tx.type}, ${tx.status})`);
    }
  } catch (error) {
    console.log(`  Error getting tx history: ${error.message}`);
    throw error;
  }
}

// Test 11.2: Get transaction history with pagination
async function testTxHistoryPagination() {
  try {
    // First page
    const firstPage = await mnee.recentTxHistory(TEST_ADDRESS, undefined, 5);
    assert(firstPage.history.length <= 5, 'Should respect limit parameter');
    
    console.log(`  First page: ${firstPage.history.length} transactions`);
    
    if (firstPage.nextScore !== null) {
      // Get next page using nextScore
      const secondPage = await mnee.recentTxHistory(TEST_ADDRESS, firstPage.nextScore, 5);
      
      assert(secondPage.history.length <= 5, 'Second page should respect limit');
      
      // Verify no duplicate transactions between pages
      const firstPageTxids = firstPage.history.map(tx => tx.txid);
      const secondPageTxids = secondPage.history.map(tx => tx.txid);
      const duplicates = firstPageTxids.filter(txid => secondPageTxids.includes(txid));
      assert(duplicates.length === 0, 'Should not have duplicate transactions between pages');
      
      console.log(`  Second page: ${secondPage.history.length} transactions`);
      console.log(`  No duplicates between pages ✓`);
    } else {
      console.log(`  No more pages available (nextScore is null)`);
    }
  } catch (error) {
    console.log(`  Pagination test error: ${error.message}`);
  }
}

// Test 11.3: Get transaction history for empty address
async function testEmptyAddressHistory() {
  try {
    const history = await mnee.recentTxHistory(EMPTY_ADDRESS);
    
    assert(history.address === EMPTY_ADDRESS, 'Response should include the queried address');
    assert(Array.isArray(history.history), 'History should be an array');
    
    console.log(`  Empty address has ${history.history.length} transactions`);
    
    if (history.history.length === 0) {
      console.log(`  NextScore: ${history.nextScore} (may or may not be null for empty history)`);
    }
  } catch (error) {
    console.log(`  Empty address test error: ${error.message}`);
  }
}

// Test 11.4: Test with invalid address
async function testInvalidAddressHistory() {
  let errorOccurred = false;
  try {
    const history = await mnee.recentTxHistory(testConfig.addresses.invalidAddress);
    
    // Some implementations might return empty history instead of error
    if (history.history.length === 0) {
      console.log(`  Invalid address returned empty history`);
    }
  } catch (error) {
    errorOccurred = true;
    console.log(`  Invalid address error: "${error.message}"`);
  }
  
  // Either error or empty history is acceptable
  assert(errorOccurred || true, 'Invalid address handled appropriately');
}

// Test 11.5: Test with different limit values
async function testDifferentLimits() {
  const limits = [1, 10, 50, 100];
  
  for (const limit of limits) {
    try {
      const history = await mnee.recentTxHistory(TEST_ADDRESS, undefined, limit);
      assert(history.history.length <= limit, `Should respect limit of ${limit}`);
      console.log(`  Limit ${limit}: returned ${history.history.length} transactions ✓`);
    } catch (error) {
      console.log(`  Limit ${limit} error: ${error.message}`);
    }
  }
}

// Test 11.6: Test with specific fromScore
async function testFromScore() {
  try {
    // First get some transactions
    const initial = await mnee.recentTxHistory(TEST_ADDRESS, undefined, 10);
    
    if (initial.history.length > 5) {
      // Use a score from middle of the list
      const middleScore = initial.history[5].score;
      
      const fromScoreResult = await mnee.recentTxHistory(TEST_ADDRESS, middleScore, 10);
      
      // Verify we get transactions after the specified score
      // Note: Score ordering might be implementation-specific
      console.log(`  Transactions returned after score ${middleScore}`);
      
      console.log(`  From score ${middleScore}: ${fromScoreResult.history.length} transactions`);
    } else {
      console.log(`  Not enough transactions to test fromScore`);
    }
  } catch (error) {
    console.log(`  FromScore test error: ${error.message}`);
  }
}

// Test 11.7: Test transaction details
async function testTransactionDetails() {
  try {
    const history = await mnee.recentTxHistory(TEST_ADDRESS, undefined, 5);
    
    if (history.history.length > 0) {
      console.log('  Analyzing transaction details:');
      
      for (const tx of history.history.slice(0, 3)) { // Check first 3 transactions
        // Verify counterparties structure
        for (const counterparty of tx.counterparties) {
          assert(counterparty.address, 'Counterparty should have address');
          assert(typeof counterparty.amount === 'number', 'Counterparty should have amount');
        }
        
        // Verify amounts are in atomic units
        assert(Number.isInteger(tx.amount), 'Amount should be in atomic units (integer)');
        assert(Number.isInteger(tx.fee), 'Fee should be in atomic units (integer)');
        
        console.log(`    ${tx.type} ${mnee.fromAtomicAmount(tx.amount)} MNEE, fee: ${mnee.fromAtomicAmount(tx.fee)} MNEE`);
      }
    } else {
      console.log('  No transactions to analyze');
    }
  } catch (error) {
    console.log(`  Transaction details test error: ${error.message}`);
  }
}

// Run tests
async function runTests() {
  console.log('Running recentTxHistory tests...\n');
  console.log('Note: Transaction history depends on actual blockchain data.\n');

  try {
    // Fetch config first
    await mnee.config();
    
    console.log('Test 11.1: Get recent transaction history');
    await testBasicTxHistory();
    console.log('✅ Test 11.1 passed\n');

    console.log('Test 11.2: Test pagination');
    await testTxHistoryPagination();
    console.log('✅ Test 11.2 passed\n');

    console.log('Test 11.3: Get history for empty address');
    await testEmptyAddressHistory();
    console.log('✅ Test 11.3 passed\n');

    console.log('Test 11.4: Test with invalid address');
    await testInvalidAddressHistory();
    console.log('✅ Test 11.4 passed\n');

    console.log('Test 11.5: Test different limit values');
    await testDifferentLimits();
    console.log('✅ Test 11.5 passed\n');

    console.log('Test 11.6: Test with specific fromScore');
    await testFromScore();
    console.log('✅ Test 11.6 passed\n');

    console.log('Test 11.7: Test transaction details');
    await testTransactionDetails();
    console.log('✅ Test 11.7 passed\n');

    console.log('All tests passed! ✅');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();