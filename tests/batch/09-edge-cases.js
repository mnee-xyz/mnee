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