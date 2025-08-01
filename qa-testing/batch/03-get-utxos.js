// Test 18.3: Batch getUtxos
import { mnee, assert, TEST_ADDRESSES } from './setup.js';

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

      console.log(`  UTXOs for ${item.address}: ${item.utxos.length}`);

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

    // Test rate limiting - just verify it completes
    const addresses = TEST_ADDRESSES.slice(0, 4);
    const startTime = Date.now();
    await batch.getUtxos(addresses, {
      chunkSize: 1,
      requestsPerSecond: 10,
    });
    const elapsed = Date.now() - startTime;
    console.log(`  Rate limiting handled ${addresses.length} addresses in ${elapsed}ms ✓`);

    // Test with invalid addresses (QA team reported issue)
    console.log('\n  Testing with invalid addresses (QA reported issue)...');
    const mixedAddresses = [
      TEST_ADDRESSES[0],  // valid
      "asddsad",         // invalid
      TEST_ADDRESSES[1]   // valid
    ];
    
    // Test with continueOnError: true (default for QA test case)
    const mixedResult = await batch.getUtxos(mixedAddresses, {
      continueOnError: true,
    });
    
    console.log(`  QA test case results: ${mixedResult.results.length} results, ${mixedResult.errors.length} errors`);
    
    // Verify we got results for all addresses (valid ones have UTXOs, invalid have empty arrays)
    assert(mixedResult.results.length === 3, 'Should return results for all addresses');
    
    // Check that valid addresses have UTXOs
    const validResults = mixedResult.results.filter(r => TEST_ADDRESSES.includes(r.address));
    assert(validResults.length === 2, 'Should have results for 2 valid addresses');
    validResults.forEach(r => {
      assert(r.utxos.length >= 0, 'Valid addresses should have utxos array (may be empty)');
    });
    
    // Check that invalid address has empty UTXOs
    const invalidResult = mixedResult.results.find(r => r.address === "asddsad");
    assert(invalidResult, 'Should have result for invalid address');
    assert(invalidResult.utxos.length === 0, 'Invalid address should have empty utxos array');
    
    // Check errors are reported
    assert(mixedResult.errors.length === 1, 'Should report 1 error for invalid address');
    assert(mixedResult.errors[0].items[0] === "asddsad", 'Error should be for the invalid address');
    assert(mixedResult.errors[0].error.message.includes('Invalid address format'), 'Error message should mention invalid format');
    
    console.log('  ✓ Batch returns results for valid addresses');
    console.log('  ✓ Invalid addresses get empty utxos array');
    console.log('  ✓ Errors reported for invalid addresses');
    console.log('  ✓ No error thrown - graceful handling confirmed');
    
    // Test with continueOnError: false
    console.log('\n  Testing continueOnError: false behavior...');
    let errorThrown = false;
    try {
      await batch.getUtxos(['invalid-address', TEST_ADDRESSES[0]], {
        continueOnError: false,
      });
    } catch (error) {
      errorThrown = true;
      assert(error.message.includes('Invalid address format'), 'Should throw with invalid address error');
    }
    assert(errorThrown, 'Should throw error when continueOnError is false');
    console.log('  ✓ continueOnError: false throws as expected');
  } catch (error) {
    console.log(`  Batch getUtxos error: ${error.message}`);
    throw error;
  }
}

// Run test
async function runTest() {
  console.log('Test 18.3: Batch getUtxos');
  await testBatchGetUtxos();
  console.log('✅ Test 18.3 passed\n');
}

runTest().catch((error) => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});
