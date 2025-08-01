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

    // Test with invalid transaction IDs (QA team test case)
    console.log('  Testing with invalid transaction IDs (QA reported issue)...');
    const mixedTxids = [
      'd7fe19af19332d8ab1d83ed82003ecc41c8c5def8e786b58e90512e82087302a',
      undefined,
      'd9d2f6764c2b67af5f7cc4088ec745ff7c3bcca9e1ae2d9b1d533f575c6b5def'
    ];
    
    // Test case as reported by QA
    const mixedResult = await batch.parseTx(mixedTxids, {
      continueOnError: true,  // This ensures we get results for valid txids
    });
    
    console.log(`  QA test case results: ${mixedResult.results.length} successful, ${mixedResult.errors.length} errors`);
    
    // Verify we got results for valid txids (not throwing an error)
    assert(mixedResult.results.length === 2, 'Should parse 2 valid transactions');
    assert(mixedResult.errors.length > 0, 'Should report errors for invalid transaction');
    
    // The batch should NOT throw an error - it should return results for valid txids
    console.log('  ✓ Batch returns parsed transactions for valid ids');
    console.log('  ✓ Batch reports errors for invalid ids');
    console.log('  ✓ No error thrown - graceful handling confirmed');
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