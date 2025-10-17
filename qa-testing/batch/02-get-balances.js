// Test 18.2: Batch getBalances
import { mnee, assert, TEST_ADDRESSES } from './setup.js';

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
      console.log(`  Balance for ${balance.address}: ${balance.decimalAmount}`);
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

// Run test
async function runTest() {
  console.log('Test 18.2: Batch getBalances');
  await testBatchGetBalances();
  console.log('✅ Test 18.2 passed\n');
}

runTest().catch((error) => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});
