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
    
    // Verify errors array contains proper error messages (QA reported this was missing)
    assert(mixedResult.errors[0].error.message, 'Error should have a message property');
    assert(mixedResult.errors[0].error.message === 'Invalid transaction ID: empty or not a string', 
           'Error message should describe the invalid txid');
    
    // The batch should NOT throw an error - it should return results for valid txids
    console.log('  ✓ Batch returns parsed transactions for valid ids');
    console.log('  ✓ Batch reports errors for invalid ids with proper error messages');
    console.log('  ✓ No error thrown - graceful handling confirmed');

    // Test with various invalid txid formats
    console.log('  Testing various invalid transaction ID formats...');
    const invalidFormats = [
      null,
      '',
      'invalid-hex',
      '123', // too short
      'd7fe19af19332d8ab1d83ed82003ecc41c8c5def8e786b58e90512e82087302a'.slice(0, -1), // 63 chars
      'd7fe19af19332d8ab1d83ed82003ecc41c8c5def8e786b58e90512e82087302aa', // 65 chars
      123456, // number instead of string
    ];
    
    // Mix invalid formats with valid txids
    const validTxid = history.history[0].txid;
    const mixedFormatsArray = [validTxid, ...invalidFormats, validTxid];
    
    const formatResult = await batch.parseTx(mixedFormatsArray, {
      continueOnError: true,
      chunkSize: 3, // Test with chunking
    });
    
    assert(formatResult.results.length === 2, 'Should parse only the 2 valid txids');
    assert(formatResult.errors.length > 0, 'Should report errors for all invalid formats');
    assert(formatResult.totalErrors === invalidFormats.length, `Should have ${invalidFormats.length} errors`);
    console.log(`  ✓ Handled ${invalidFormats.length} invalid formats correctly`);

    // Test that continueOnError: false actually throws
    console.log('  Testing continueOnError: false behavior...');
    let errorThrown = false;
    try {
      await batch.parseTx(['invalid-txid', validTxid], {
        continueOnError: false,
        chunkSize: 5,
      });
    } catch (error) {
      errorThrown = true;
      assert(error.message.includes('Invalid transaction ID format'), 'Should throw with invalid format error');
    }
    assert(errorThrown, 'Should throw error when continueOnError is false');
    console.log('  ✓ continueOnError: false throws as expected');

    // Test QA scenario with chunkSize = 2 as specifically mentioned
    console.log('  Testing QA scenario with chunkSize = 2...');
    const qaChunkTest = [
      'd7fe19af19332d8ab1d83ed82003ecc41c8c5def8e786b58e90512e82087302a',
      undefined,  // This will be in first chunk with valid txid
      'd9d2f6764c2b67af5f7cc4088ec745ff7c3bcca9e1ae2d9b1d533f575c6b5def'  // This will be in second chunk alone
    ];
    
    const chunkResult = await batch.parseTx(qaChunkTest, {
      continueOnError: true,
      chunkSize: 2
    });
    
    assert(chunkResult.results.length === 2, 'Should parse both valid transactions across chunks');
    assert(chunkResult.errors.length === 1, 'Should have one error for undefined txid');
    assert(chunkResult.errors[0].error.message, 'Error should have message even with chunking');
    console.log('  ✓ Chunking works correctly with mixed valid/invalid txids');
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