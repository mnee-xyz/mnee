// Test 18.6: Error handling and retry
import { mnee, assert, testConfig } from './setup.js';

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
      requestsPerSecond: 10,
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
      requestsPerSecond: 10,
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

// Run test
async function runTest() {
  console.log('Test 18.6: Error handling and retry');
  await testBatchErrorHandling();
  console.log('✅ Test 18.6 passed\n');
}

runTest().catch(error => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});