// Test 18.6: Error handling and retry
import { mnee, assert, testConfig } from './setup.js';

async function testBatchErrorHandling() {
  try {
    const batch = mnee.batch();

    // Note: getBalances filters invalid addresses at service level

    // Test error propagation with parseTx
    let errorThrown = false;
    let errorMessage = '';
    try {
      const invalidTxids = ['invalid-txid', 'd7fe19af19332d8ab1d83ed82003ecc41c8c5def8e786b58e90512e82087302a'];
      await batch.parseTx(invalidTxids, {
        chunkSize: 2,
        continueOnError: false, // Should throw on first error
        requestsPerSecond: 10,
      });
    } catch (error) {
      errorThrown = true;
      errorMessage = error.message;
    }
    assert(errorThrown, 'Should throw error when continueOnError is false');
    assert(errorMessage.includes('Invalid transaction ID'), `Error should mention invalid txid, got: ${errorMessage}`);
    console.log('  Error propagation works ✓');

    // Test continueOnError = true with parseTx (which can actually produce errors)
    const history = await mnee.recentTxHistory(testConfig.addresses.testAddress, undefined, 2);
    let validTxid = null;
    if (history.history.length > 0) {
      validTxid = history.history[0].txid;
    }
    
    const mixedTxids = [validTxid, 'invalid-txid-123', validTxid, null].filter(Boolean);
    const result = await batch.parseTx(mixedTxids, {
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
    });

    console.log('  Continue on error works ✓');
    console.log(`  Captured ${result.errors.length} errors with retry ✓`);

    // Test that errors are captured in final result
    const errorTestResult = await batch.parseTx(['invalid-1', validTxid, 'invalid-2'], {
      chunkSize: 2,
      continueOnError: true,
      requestsPerSecond: 10,
    });

    assert(errorTestResult.results.length === 1, 'Should have one successful result');
    assert(errorTestResult.errors.length === 2, 'Should have two errors');
    assert(errorTestResult.totalErrors === 2, 'Total errors should be 2');
    console.log('  Error tracking works correctly ✓');

    // Test non-array input validation (QA reported issue)
    console.log('\n  Testing non-array input validation...');
    
    // Test various non-array inputs
    const nonArrayInputs = [
      { value: null, name: 'null' },
      { value: undefined, name: 'undefined' },
      { value: 'single-string', name: 'string' },
      { value: 12345, name: 'number' },
      { value: { address: testConfig.addresses.testAddress }, name: 'object' },
      { value: true, name: 'boolean' },
    ];

    // Test getUtxos with non-array inputs
    for (const input of nonArrayInputs) {
      try {
        await batch.getUtxos(input.value);
        assert(false, `getUtxos should throw for ${input.name}`);
      } catch (error) {
        assert(error.message === 'Input must be an array of addresses', 
          `getUtxos should have correct error message for ${input.name}`);
      }
    }
    console.log('  ✓ getUtxos validates non-array inputs');

    // Test getBalances with non-array inputs
    for (const input of nonArrayInputs) {
      try {
        await batch.getBalances(input.value);
        assert(false, `getBalances should throw for ${input.name}`);
      } catch (error) {
        assert(error.message === 'Input must be an array of addresses',
          `getBalances should have correct error message for ${input.name}`);
      }
    }
    console.log('  ✓ getBalances validates non-array inputs');

    // Test parseTx with non-array inputs
    for (const input of nonArrayInputs) {
      try {
        await batch.parseTx(input.value);
        assert(false, `parseTx should throw for ${input.name}`);
      } catch (error) {
        assert(error.message === 'Input must be an array of transaction IDs',
          `parseTx should have correct error message for ${input.name}`);
      }
    }
    console.log('  ✓ parseTx validates non-array inputs');

    // Test getTxHistories with non-array inputs
    for (const input of nonArrayInputs) {
      try {
        await batch.getTxHistories(input.value);
        assert(false, `getTxHistories should throw for ${input.name}`);
      } catch (error) {
        assert(error.message === 'Input must be an array of address history parameters',
          `getTxHistories should have correct error message for ${input.name}`);
      }
    }
    console.log('  ✓ getTxHistories validates non-array inputs');

    // Verify that valid array inputs still work
    const validResult = await batch.getBalances([testConfig.addresses.testAddress]);
    assert(validResult.results.length === 1, 'Valid array input should work');
    console.log('  ✓ Valid array inputs continue to work');
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