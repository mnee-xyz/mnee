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
