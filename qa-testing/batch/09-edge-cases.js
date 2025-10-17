// Test 18.9: Edge cases
import { mnee, assert, TEST_ADDRESSES, testConfig } from './setup.js';

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

    // Test parseTx with all invalid txids
    console.log('\n  Testing edge cases for invalid inputs...');
    const allInvalidTxids = [undefined, null, '', 'invalid'];
    const allInvalidResult = await batch.parseTx(allInvalidTxids, {
      continueOnError: true,
      chunkSize: 2,
    });
    assert(allInvalidResult.results.length === 0, 'Should have no successful results');
    assert(allInvalidResult.errors.length > 0, 'Should have errors');
    assert(allInvalidResult.totalErrors === allInvalidResult.errors.length, 'Error count should match');
    console.log('  All invalid txids handled correctly ✓');

    // Test with mixed valid/invalid in single chunk
    const history = await mnee.recentTxHistory(testConfig.addresses.testAddress, undefined, 2);
    if (history.history.length > 0) {
      const mixedChunk = [history.history[0].txid, null, undefined];
      const mixedChunkResult = await batch.parseTx(mixedChunk, {
        continueOnError: true,
        chunkSize: 10, // Force single chunk
      });
      assert(mixedChunkResult.results.length === 1, 'Should parse valid txid in mixed chunk');
      assert(mixedChunkResult.errors.length > 0, 'Should report errors for invalid txids');
      console.log('  Mixed valid/invalid in single chunk works ✓');
    }

    // Test empty arrays for all batch methods
    const emptyUtxos = await batch.getUtxos([]);
    assert(emptyUtxos.results.length === 0, 'Empty array should return empty results');
    assert(emptyUtxos.totalProcessed === 0, 'Should process 0 items');
    
    const emptyBalances = await batch.getBalances([]);
    assert(emptyBalances.results.length === 0, 'Empty array should return empty results');
    
    const emptyParseTx = await batch.parseTx([]);
    assert(emptyParseTx.results.length === 0, 'Empty array should return empty results');
    
    const emptyHistories = await batch.getTxHistories([]);
    assert(emptyHistories.results.length === 0, 'Empty array should return empty results');
    
    console.log('  Empty arrays handled correctly ✓');

    // Test negative chunk size (should use default)
    const negativeChunkResult = await batch.getBalances([testConfig.addresses.testAddress], {
      chunkSize: -5,
      requestsPerSecond: 10,
    });
    assert(negativeChunkResult.results.length === 1, 'Negative chunk size should use default');
    console.log('  Negative chunk size uses default ✓');

    // Test requestsPerSecond edge cases (QA reported issue)
    console.log('\n  Testing requestsPerSecond edge cases...');
    
    // Test with requestsPerSecond = 0
    const zeroRpsAddresses = [testConfig.addresses.testAddress, testConfig.addresses.emptyAddress];
    const startTimeZero = Date.now();
    const zeroRpsResult = await batch.getBalances(zeroRpsAddresses, {
      chunkSize: 10,
      requestsPerSecond: 0,
    });
    const elapsedZero = Date.now() - startTimeZero;
    assert(zeroRpsResult.results.length === 2, 'Should process with requestsPerSecond=0');
    assert(elapsedZero < 5000, 'Should complete in reasonable time with requestsPerSecond=0');
    console.log(`  ✓ requestsPerSecond=0 uses default (completed in ${elapsedZero}ms)`);
    
    // Test with negative requestsPerSecond
    const startTimeNeg = Date.now();
    const negRpsResult = await batch.getBalances([testConfig.addresses.testAddress], {
      requestsPerSecond: -5,
    });
    const elapsedNeg = Date.now() - startTimeNeg;
    assert(negRpsResult.results.length === 1, 'Should process with negative requestsPerSecond');
    assert(elapsedNeg < 5000, 'Should complete in reasonable time with negative requestsPerSecond');
    console.log(`  ✓ negative requestsPerSecond uses default (completed in ${elapsedNeg}ms)`);
  } catch (error) {
    console.log(`  Batch edge cases error: ${error.message}`);
    throw error;
  }
}

// Run test
async function runTest() {
  console.log('Test 18.9: Edge cases');
  await testBatchEdgeCases();
  console.log('✅ Test 18.9 passed\n');
}

runTest().catch(error => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});