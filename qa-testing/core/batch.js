import Mnee from 'mnee';
import assert from 'assert';
import testConfig from '../testConfig.js';

// Test configuration
const config = {
  environment: testConfig.environment,
  apiKey: testConfig.apiKey,
};

const mnee = new Mnee(config);

// Test addresses for batch operations
const TEST_ADDRESSES = [
  testConfig.addresses.testAddress,
  testConfig.addresses.emptyAddress,
  '1ERN5r4A8Ur6T4XQgaxQLmWtRAmusga5xZ',
  '159zQuZRmHUrZArYTFgogQxndrAeSsbTtJ',
  '1Q9gVBxBdu7hmRv7KJg8mRFcSCTNNH8JdZ',
];

// Test 18.1: Batch instance creation
async function testBatchCreation() {
  try {
    const batch = mnee.batch();
    assert(batch, 'Batch instance should be created');
    assert(typeof batch.getUtxos === 'function', 'Should have getUtxos method');
    assert(typeof batch.getBalances === 'function', 'Should have getBalances method');
    assert(typeof batch.getTxHistories === 'function', 'Should have getTxHistories method');
    assert(typeof batch.parseTx === 'function', 'Should have parseTx method');
    console.log('  Batch instance created with all methods ✓');

    // Test that batch is a singleton-like instance per mnee instance
    const batch2 = mnee.batch();
    assert(batch === batch2, 'Should return same batch instance');
    console.log('  Batch returns same instance ✓');
  } catch (error) {
    console.log(`  Batch creation error: ${error.message}`);
    throw error;
  }
}

// Test 18.2: Batch getBalances
async function testBatchGetBalances() {
  try {
    const batch = mnee.batch();

    // Test with default options
    const result = await batch.getBalances(TEST_ADDRESSES.slice(0, 3), {
      requestsPerSecond: 10,
    });

    assert(result.results, 'Should have results array');
    assert(result.errors, 'Should have errors array');
    assert(typeof result.totalProcessed === 'number', 'Should have totalProcessed');
    assert(typeof result.totalErrors === 'number', 'Should have totalErrors');

    assert(result.results.length > 0, 'Should return some results');
    assert(result.totalProcessed > 0, 'Should process at least one chunk');

    // Verify balance structure
    result.results.forEach((balance) => {
      assert(balance.address, 'Balance should have address');
      assert(typeof balance.amount === 'number', 'Balance should have amount');
      assert(typeof balance.decimalAmount === 'number', 'Balance should have decimalAmount');
      assert(TEST_ADDRESSES.includes(balance.address), 'Address should be from input list');
    });

    console.log(`  Batch processed ${result.results.length} balances ✓`);

    // Test with custom chunk size
    const resultChunked = await batch.getBalances(TEST_ADDRESSES, {
      chunkSize: 2,
      requestsPerSecond: 10,
    });

    assert(
      resultChunked.totalProcessed >= Math.ceil(TEST_ADDRESSES.length / 2),
      'Should process correct number of chunks',
    );
    console.log('  Custom chunk size works ✓');

    // Test with empty array
    const emptyResult = await batch.getBalances([]);
    assert(emptyResult.results.length === 0, 'Empty input should return empty results');
    assert(emptyResult.totalProcessed === 0, 'Empty input should process 0 chunks');
    console.log('  Empty array handled correctly ✓');
  } catch (error) {
    console.log(`  Batch getBalances error: ${error.message}`);
    throw error;
  }
}

// Test 18.3: Batch getUtxos
async function testBatchGetUtxos() {
  try {
    const batch = mnee.batch();

    // Track progress
    let progressCalls = 0;
    let lastProgress = { completed: 0, total: 0, errors: 0 };

    const result = await batch.getUtxos(TEST_ADDRESSES.slice(0, 3), {
      chunkSize: 2,
      requestsPerSecond: 10,
      onProgress: (completed, total, errors) => {
        progressCalls++;
        lastProgress = { completed, total, errors };
      },
    });

    assert(result.results, 'Should have results array');
    assert(Array.isArray(result.results), 'Results should be array');

    // Verify UTXO result structure
    result.results.forEach((item) => {
      assert(item.address, 'Should have address');
      assert(Array.isArray(item.utxos), 'Should have utxos array');
      assert(TEST_ADDRESSES.includes(item.address), 'Address should be from input');

      // Verify UTXOs belong to the address
      item.utxos.forEach((utxo) => {
        assert(utxo.owners.includes(item.address), 'UTXO should belong to address');
        assert(utxo.txid, 'UTXO should have txid');
        assert(typeof utxo.vout === 'number', 'UTXO should have vout');
        assert(utxo.data, 'UTXO should have data');
      });
    });

    console.log(`  Batch retrieved UTXOs for ${result.results.length} addresses ✓`);

    // Verify progress callback
    assert(progressCalls > 0, 'Progress callback should be called');
    assert(lastProgress.completed === lastProgress.total, 'Should complete all chunks');
    console.log('  Progress tracking works ✓');

    // Test rate limiting - measure time taken
    const startTime = Date.now();
    const addresses = TEST_ADDRESSES.slice(0, 4);
    await batch.getUtxos(addresses, {
      chunkSize: 1,
      requestsPerSecond: 10, // High rate to test limiting
    });
    const elapsed = Date.now() - startTime;

    // Should take at least (chunks-1) * minDelay
    const expectedMinTime = 3 * 100; // 4 chunks, 100ms min delay
    assert(elapsed >= expectedMinTime, 'Rate limiting should enforce minimum delay');
    console.log('  Rate limiting enforced ✓');
  } catch (error) {
    console.log(`  Batch getUtxos error: ${error.message}`);
    throw error;
  }
}

// Test 18.4: Batch getTxHistories
async function testBatchGetTxHistories() {
  try {
    const batch = mnee.batch();

    // Create params for history
    const params = TEST_ADDRESSES.slice(0, 3).map((address) => ({
      address,
      limit: 5,
      fromScore: undefined,
    }));

    const result = await batch.getTxHistories(params, {
      chunkSize: 2,
      requestsPerSecond: 10,
    });

    assert(result.results, 'Should have results array');
    assert(result.results.length > 0, 'Should return results');

    // Verify history structure
    result.results.forEach((history) => {
      assert(history.address, 'History should have address');
      assert(Array.isArray(history.history), 'Should have history array');
      assert(
        params.some((p) => p.address === history.address),
        'Address should be from params',
      );

      // Verify transaction structure
      history.history.forEach((tx) => {
        assert(tx.txid, 'Transaction should have txid');
        assert(typeof tx.height === 'number', 'Transaction should have height');
        assert(tx.status, 'Transaction should have status');
        assert(tx.type, 'Transaction should have type');
        assert(typeof tx.amount === 'number', 'Transaction should have amount');
        assert(Array.isArray(tx.counterparties), 'Transaction should have counterparties');
      });
    });

    console.log(`  Batch retrieved history for ${result.results.length} addresses ✓`);

    // Test with mixed params
    const mixedParams = [
      { address: TEST_ADDRESSES[0], limit: 10 },
      { address: TEST_ADDRESSES[1], limit: 5, fromScore: 100 },
    ];

    const mixedResult = await batch.getTxHistories(mixedParams, {
      requestsPerSecond: 10,
    });
    assert(mixedResult.results.length > 0, 'Mixed params should work');
    console.log('  Mixed parameters handled correctly ✓');
  } catch (error) {
    console.log(`  Batch getTxHistories error: ${error.message}`);
    throw error;
  }
}

// Test 18.5: Batch parseTx
async function testBatchParseTx() {
  try {
    const batch = mnee.batch();

    // First get some transaction IDs from history
    const history = await mnee.recentTxHistory(testConfig.addresses.testAddress, undefined, 5);
    const txids = history.history.slice(0, 3).map((tx) => tx.txid);

    if (txids.length === 0) {
      console.log('  No transactions found for parsing test - skipping');
      return;
    }

    // Test basic parsing
    const result = await batch.parseTx(txids, {
      chunkSize: 2,
      requestsPerSecond: 10,
    });

    assert(result.results, 'Should have results array');
    assert(result.results.length > 0, 'Should parse some transactions');

    // Verify parsed transaction structure
    result.results.forEach((item) => {
      assert(item.txid, 'Should have txid');
      assert(item.parsed, 'Should have parsed data');
      assert(item.parsed.txid === item.txid, 'Txid should match');
      assert(item.parsed.type, 'Should have transaction type');
      assert(typeof item.parsed.isValid === 'boolean', 'Should have isValid flag');
      assert(Array.isArray(item.parsed.inputs), 'Should have inputs array');
      assert(Array.isArray(item.parsed.outputs), 'Should have outputs array');
    });

    console.log(`  Batch parsed ${result.results.length} transactions ✓`);

    // Test with includeRaw option
    const rawResult = await batch.parseTx(txids.slice(0, 2), {
      parseOptions: { includeRaw: true },
      chunkSize: 1,
      requestsPerSecond: 10,
    });

    assert(rawResult.results.length > 0, 'Should parse with raw data');
    const hasRaw = rawResult.results.some((r) => r.parsed.raw);
    assert(hasRaw, 'Should include raw transaction data');
    console.log('  Parse with raw data works ✓');
  } catch (error) {
    console.log(`  Batch parseTx error: ${error.message}`);
    throw error;
  }
}

// Test 18.6: Error handling and retry
async function testBatchErrorHandling() {
  try {
    const batch = mnee.batch();

    // Mix valid and invalid addresses
    const mixedAddresses = [
      testConfig.addresses.testAddress,
      'invalid-address-1',
      testConfig.addresses.emptyAddress,
      'not-a-valid-bitcoin-address',
    ];

    // Test continueOnError = false (default)
    let errorThrown = false;
    try {
      await batch.getBalances(mixedAddresses, {
        chunkSize: 2,
        continueOnError: false,
        requestsPerSecond: 10,
      });
    } catch (error) {
      errorThrown = true;
    }
    assert(errorThrown, 'Should throw error when continueOnError is false');
    console.log('  Error propagation works ✓');

    // Test continueOnError = true
    const result = await batch.getBalances(mixedAddresses, {
      chunkSize: 2,
      continueOnError: true,
      maxRetries: 2,
      retryDelay: 100,
      requestsPerSecond: 10, // Use your API key's limit
    });

    assert(result.results.length > 0, 'Should return some results');
    assert(result.errors.length > 0, 'Should capture errors');
    assert(result.totalErrors > 0, 'Should count errors');

    // Verify error structure
    result.errors.forEach((error) => {
      assert(Array.isArray(error.items), 'Error should have items array');
      assert(error.error instanceof Error, 'Should have Error object');
      assert(typeof error.retryCount === 'number', 'Should have retry count');
      assert(error.retryCount === 2, 'Should respect maxRetries');
    });

    console.log('  Continue on error works ✓');
    console.log(`  Captured ${result.errors.length} errors with retry ✓`);

    // Test progress with errors
    let errorCount = 0;
    await batch.getBalances(mixedAddresses, {
      chunkSize: 2,
      continueOnError: true,
      requestsPerSecond: 10, // Use your API key's limit
      onProgress: (_completed, _total, errors) => {
        errorCount = errors;
      },
    });

    assert(errorCount > 0, 'Progress should report errors');
    console.log('  Progress tracks errors correctly ✓');
  } catch (error) {
    console.log(`  Batch error handling error: ${error.message}`);
    throw error;
  }
}

// Test 18.7: Rate limiting and concurrency
async function testBatchRateLimiting() {
  try {
    const batch = mnee.batch();

    // Test 1: Basic rate limiting - use conservative settings
    const addresses = TEST_ADDRESSES.slice(0, 3);
    const startTime = Date.now();
    const result = await batch.getBalances(addresses, {
      chunkSize: 3, // Single chunk to avoid overwhelming
      requestsPerSecond: 10,
    });
    const elapsed = Date.now() - startTime;

    assert(result.results.length === addresses.length, 'Should process all addresses');
    console.log(`  Processed ${addresses.length} addresses in ${elapsed}ms ✓`);

    // Test 2: Test chunking with small batches
    const mediumBatch = TEST_ADDRESSES.slice(0, 4);
    const chunkResult = await batch.getBalances(mediumBatch, {
      chunkSize: 2, // 2 chunks of 2
      requestsPerSecond: 10, // Very conservative
      retryDelay: 2000, // Longer retry delay
    });

    assert(chunkResult.results.length === mediumBatch.length, 'Should handle chunked batches');
    console.log(`  Chunked processing works correctly ✓`);

    // Test 3: Verify options are respected
    const customOptions = {
      chunkSize: 5,
      requestsPerSecond: 10,
      maxRetries: 2,
      continueOnError: true,
    };

    const optionsResult = await batch.getBalances([TEST_ADDRESSES[0]], customOptions);
    assert(optionsResult.results.length === 1, 'Custom options should work');
    console.log('  Rate limiting configuration respected ✓');
  } catch (error) {
    console.log(`  Batch rate limiting error: ${error.message}`);
    throw error;
  }
}

// Test 18.8: Batch with HD wallet integration
async function testBatchWithHDWallet() {
  try {
    const batch = mnee.batch();

    // Generate HD wallet addresses
    const mnemonic = Mnee.HDWallet.generateMnemonic();
    const hdWallet = mnee.HDWallet(mnemonic, {
      derivationPath: "m/44'/236'/0'",
    });

    // Generate 10 addresses
    const hdAddresses = [];
    for (let i = 0; i < 10; i++) {
      hdAddresses.push(hdWallet.deriveAddress(i, false).address);
    }

    // Batch check balances
    const result = await batch.getBalances(hdAddresses, {
      chunkSize: 5,
      requestsPerSecond: 10,
    });

    assert(result.results.length === hdAddresses.length, 'Should check all HD addresses');
    assert(result.totalProcessed === 2, 'Should process 2 chunks of 5');

    // All new addresses should have 0 balance
    const allZeroBalance = result.results.every((b) => b.decimalAmount === 0);
    assert(allZeroBalance, 'New HD addresses should have 0 balance');

    console.log('  HD wallet batch integration works ✓');

    // Test UTXO scanning for HD addresses
    const utxoResult = await batch.getUtxos(hdAddresses, {
      chunkSize: 3,
      requestsPerSecond: 10,
      onProgress: (completed, total) => {
        assert(completed <= total, 'Progress should not exceed total');
        assert(completed > 0 && total > 0, 'Progress values should be positive');
      },
    });

    assert(utxoResult.results.length === hdAddresses.length, 'Should scan all addresses');
    const allEmpty = utxoResult.results.every((r) => r.utxos.length === 0);
    assert(allEmpty, 'New addresses should have no UTXOs');

    console.log('  HD wallet UTXO scanning works ✓');
  } catch (error) {
    console.log(`  Batch HD wallet error: ${error.message}`);
    throw error;
  }
}

// Test 18.9: Edge cases
async function testBatchEdgeCases() {
  try {
    const batch = mnee.batch();

    // Test with single item (should still work)
    const singleResult = await batch.getBalances([testConfig.addresses.testAddress]);
    assert(singleResult.results.length === 1, 'Should handle single item');
    assert(singleResult.totalProcessed === 1, 'Should process 1 chunk');
    console.log('  Single item batch works ✓');

    // Test with chunk size larger than array
    const smallResult = await batch.getBalances(TEST_ADDRESSES.slice(0, 2), {
      chunkSize: 10,
      requestsPerSecond: 10,
    });
    assert(smallResult.results.length === 2, 'Should handle oversized chunks');
    assert(smallResult.totalProcessed === 1, 'Should process as single chunk');
    console.log('  Oversized chunk handled ✓');

    // Test with zero chunk size (should use default)
    const testAddrs = TEST_ADDRESSES.slice(0, 3);
    const zeroChunkResult = await batch.getBalances(testAddrs, {
      chunkSize: 0,
      requestsPerSecond: 10,
    });
    assert(zeroChunkResult.results.length === 3, 'Should use default chunk size');
    console.log('  Zero chunk size uses default ✓');

    // Test with duplicate addresses (small test to avoid memory issues)
    const duplicates = [TEST_ADDRESSES[0], TEST_ADDRESSES[0], TEST_ADDRESSES[1]];
    const dupResult = await batch.getBalances(duplicates, {
      requestsPerSecond: 10
    });
    assert(dupResult.results.length === 3, 'Should process duplicates');
    const firstTwo = dupResult.results.slice(0, 2);
    assert(firstTwo[0].address === firstTwo[1].address, 'Duplicates should return same data');
    assert(firstTwo[0].decimalAmount === firstTwo[1].decimalAmount, 'Duplicate balances should match');
    console.log('  Duplicate addresses handled ✓');
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  } catch (error) {
    console.log(`  Batch edge cases error: ${error.message}`);
    throw error;
  }
}

// Run tests
async function runTests() {
  console.log('Running batch tests...\n');
  console.log('Note: Batch provides efficient bulk operations with rate limiting.\n');

  try {
    console.log('Test 18.1: Batch instance creation');
    await testBatchCreation();
    console.log('✅ Test 18.1 passed\n');

    console.log('Test 18.2: Batch getBalances');
    await testBatchGetBalances();
    console.log('✅ Test 18.2 passed\n');

    console.log('Test 18.3: Batch getUtxos');
    await testBatchGetUtxos();
    console.log('✅ Test 18.3 passed\n');

    console.log('Test 18.4: Batch getTxHistories');
    await testBatchGetTxHistories();
    console.log('✅ Test 18.4 passed\n');

    console.log('Test 18.5: Batch parseTx');
    await testBatchParseTx();
    console.log('✅ Test 18.5 passed\n');

    console.log('Test 18.6: Error handling and retry');
    await testBatchErrorHandling();
    console.log('✅ Test 18.6 passed\n');

    console.log('Test 18.7: Rate limiting and concurrency');
    await testBatchRateLimiting();
    console.log('✅ Test 18.7 passed\n');

    console.log('Test 18.8: Batch with HD wallet integration');
    await testBatchWithHDWallet();
    console.log('✅ Test 18.8 passed\n');

    console.log('Test 18.9: Edge cases');
    await testBatchEdgeCases();
    console.log('✅ Test 18.9 passed\n');

    console.log('All tests passed! ✅');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
