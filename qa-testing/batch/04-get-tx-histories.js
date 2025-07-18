// Test 18.4: Batch getTxHistories
import { mnee, assert, TEST_ADDRESSES } from './setup.js';

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

      console.log(`  History for ${history.address}: ${history.history.length}`);

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

// Run test
async function runTest() {
  console.log('Test 18.4: Batch getTxHistories');
  await testBatchGetTxHistories();
  console.log('✅ Test 18.4 passed\n');
}

runTest().catch((error) => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});
