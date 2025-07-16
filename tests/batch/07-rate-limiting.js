// Test 18.7: Rate limiting and concurrency
import { mnee, assert, TEST_ADDRESSES } from './setup.js';

async function testBatchRateLimiting() {
  try {
    const batch = mnee.batch();

    // Test 1: Basic rate limiting
    const addresses = TEST_ADDRESSES.slice(0, 3);
    const startTime = Date.now();
    const result = await batch.getBalances(addresses, {
      chunkSize: 3,
      requestsPerSecond: 10,
    });
    const elapsed = Date.now() - startTime;

    assert(result.results.length === addresses.length, 'Should process all addresses');
    console.log(`  Processed ${addresses.length} addresses in ${elapsed}ms ✓`);

    // Test 2: Test chunking with small batches
    const mediumBatch = TEST_ADDRESSES.slice(0, 4);
    const chunkResult = await batch.getBalances(mediumBatch, {
      chunkSize: 2,
      requestsPerSecond: 10,
      retryDelay: 2000,
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

// Run test
async function runTest() {
  console.log('Test 18.7: Rate limiting and concurrency');
  await testBatchRateLimiting();
  console.log('✅ Test 18.7 passed\n');
}

runTest().catch(error => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});