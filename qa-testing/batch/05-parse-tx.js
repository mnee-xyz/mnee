// Test 18.5: Batch parseTx
import { mnee, assert, testConfig } from './setup.js';

async function testBatchParseTx() {
  try {
    const batch = mnee.batch();

    // First get some transaction IDs from history
    const history = await mnee.recentTxHistory(testConfig.addresses.testAddress, undefined, 5);
    const txids = history.history.slice(0, 3).map((tx) => tx.txid);

    if (txids.length === 0) {
      console.log('  No transactions found for parsing test - skipping');
      return;
    }

    // Test basic parsing
    const result = await batch.parseTx(txids, {
      chunkSize: 2,
      requestsPerSecond: 10,
    });

    assert(result.results, 'Should have results array');
    assert(result.results.length > 0, 'Should parse some transactions');

    // Verify parsed transaction structure
    result.results.forEach((item) => {
      assert(item.txid, 'Should have txid');
      assert(item.parsed, 'Should have parsed data');
      assert(item.parsed.txid === item.txid, 'Txid should match');
      assert(item.parsed.type, 'Should have transaction type');
      assert(typeof item.parsed.isValid === 'boolean', 'Should have isValid flag');
      assert(Array.isArray(item.parsed.inputs), 'Should have inputs array');
      assert(Array.isArray(item.parsed.outputs), 'Should have outputs array');
    });

    console.log(`  Batch parsed ${result.results.length} transactions ✓`);

    // Test with includeRaw option
    const rawResult = await batch.parseTx(txids.slice(0, 2), {
      parseOptions: { includeRaw: true },
      chunkSize: 1,
      requestsPerSecond: 10,
    });

    assert(rawResult.results.length > 0, 'Should parse with raw data');
    const hasRaw = rawResult.results.some((r) => r.parsed.raw);
    assert(hasRaw, 'Should include raw transaction data');
    console.log('  Parse with raw data works ✓');
  } catch (error) {
    console.log(`  Batch parseTx error: ${error.message}`);
    throw error;
  }
}

// Run test
async function runTest() {
  console.log('Test 18.5: Batch parseTx');
  await testBatchParseTx();
  console.log('✅ Test 18.5 passed\n');
}

runTest().catch(error => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});