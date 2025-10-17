// Test 18.1: Batch instance creation
import { mnee, assert } from './setup.js';

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

// Run test
async function runTest() {
  console.log('Test 18.1: Batch instance creation');
  await testBatchCreation();
  console.log('✅ Test 18.1 passed\n');
}

runTest().catch(error => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});