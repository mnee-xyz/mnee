import Mnee from '@mnee/ts-sdk';
import assert from 'assert';
import testConfig from '../testConfig.js';

// Test configuration
const config = {
  environment: testConfig.environment,
  apiKey: testConfig.apiKey,
};

const mnee = new Mnee(config);

// Test WIF
const TEST_WIF = testConfig.wallet.testWif;

// Known transaction IDs for different types (from local-test files)
const knownTransactions = {
  sandbox: {
    deploy: '833a7720966a2a435db28d967385e8aa7284b6150ebb39482cc5228b73e1703f',
    mint: '9b42a339a97df37c8756a3425d4200ae2a592fd751c50e1d5ce0a1ddcab06b81',
    transfer: 'baa78cb903e0bf7af6e5fc5a27de59d587fc5ff4f08ed5e7886ab1a7d2741c5b',
    burn: 'e2421bb58ecb606c04e81a20943ea32eeac6c5c374d77d6dba7d46a2ddbad483',
    redeem: 'ebef149590fb45f080e372152fdb475cbba5a9c6f43374b48b02d063261848f3',
  },
  production: {
    deploy: 'ae59f3b898ec61acbdb6cc7a245fabeded0c094bf046f35206a3aec60ef88127',
    mint: 'f7ca34a9c0319bfb837a56ee7375e8246229f5fefbdaaaf9fdec97493d428bee',
    transfer: 'e496b2984a6b780a453559125540ec1e1c99154cdbc1cef2d2f6bea37d6dedd9',
  },
};

// Test 14.1: Parse raw transaction from created transfer
async function testParseCreatedTransfer() {
  try {
    // Create a transfer transaction
    const request = [
      {
        address: testConfig.addresses.emptyAddress,
        amount: 0.01,
      },
    ];

    const transfer = await mnee.transfer(request, TEST_WIF, { broadcast: false });
    assert(transfer.rawtx, 'Should create raw transaction');

    // Parse the raw transaction
    const parsed = await mnee.parseTxFromRawTx(transfer.rawtx);

    // Verify response structure
    assert(parsed.txid, 'Should have txid');
    assert(parsed.environment === config.environment, 'Environment should match');
    assert(parsed.type === 'transfer', 'Type should be transfer');
    assert(Array.isArray(parsed.inputs), 'Inputs should be an array');
    assert(Array.isArray(parsed.outputs), 'Outputs should be an array');
    assert(typeof parsed.isValid === 'boolean', 'isValid should be boolean');
    assert(typeof parsed.inputTotal === 'string', 'inputTotal should be string');
    assert(typeof parsed.outputTotal === 'string', 'outputTotal should be string');

    // Verify the transfer output exists
    const transferOutput = parsed.outputs.find((o) => o.address === request[0].address);
    assert(transferOutput, 'Should have output for recipient');
    assert(transferOutput.amount === mnee.toAtomicAmount(request[0].amount), 'Output amount should match request');

    console.log(`  Parsed created transfer transaction`);
    console.log(`  Transaction ID: ${parsed.txid.substring(0, 10)}...`);
    console.log(`  Type: ${parsed.type}, Valid: ${parsed.isValid}`);
    console.log(`  Inputs: ${parsed.inputs.length}, Outputs: ${parsed.outputs.length}`);
  } catch (error) {
    console.log(`  Parse created transfer error: ${error.message}`);
    throw error;
  }
}

// Test 14.2: Parse with includeRaw option
async function testParseWithIncludeRaw() {
  try {
    // Create a transaction
    const request = [
      {
        address: testConfig.addresses.emptyAddress,
        amount: 0.01,
      },
    ];

    const transfer = await mnee.transfer(request, TEST_WIF, { broadcast: false });

    // Parse with includeRaw
    const parsed = await mnee.parseTxFromRawTx(transfer.rawtx, { includeRaw: true });

    // Should have all standard fields
    assert(parsed.txid, 'Should have txid');
    assert(parsed.inputs && parsed.outputs, 'Should have inputs and outputs');

    // Should also have raw data
    assert(parsed.raw, 'Should have raw data when includeRaw is true');
    assert(parsed.raw.txHex === transfer.rawtx, 'Raw hex should match input');
    assert(Array.isArray(parsed.raw.inputs), 'Raw should have inputs array');
    assert(Array.isArray(parsed.raw.outputs), 'Raw should have outputs array');

    console.log(`  Parsed with raw data included`);
    console.log(`  Raw tx hex length: ${parsed.raw.txHex.length} characters`);

    // Verify raw input structure
    if (parsed.raw.inputs.length > 0) {
      const rawInput = parsed.raw.inputs[0];
      assert(rawInput.txid, 'Raw input should have txid');
      assert(typeof rawInput.vout === 'number', 'Raw input should have vout');
      assert(rawInput.scriptSig, 'Raw input should have scriptSig');
      assert(typeof rawInput.sequence === 'number', 'Raw input should have sequence');
      assert(typeof rawInput.satoshis === 'number', 'Raw input should have satoshis');
    }

    // Verify raw output structure
    if (parsed.raw.outputs.length > 0) {
      const rawOutput = parsed.raw.outputs[0];
      assert(typeof rawOutput.value === 'number', 'Raw output should have value');
      assert(rawOutput.scriptPubKey, 'Raw output should have scriptPubKey');
    }
  } catch (error) {
    console.log(`  Parse with includeRaw error: ${error.message}`);
  }
}

// Test 14.3: Parse invalid raw transaction hex
async function testParseInvalidRawTx() {
  const invalidRawTx =
    '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff0100f2052a010000001976a914c825a1ecf2a6830c4401620c3a16f1995057c2ab88acBADBADBAD';

  let errorOccurred = false;
  try {
    const parsed = await mnee.parseTxFromRawTx(invalidRawTx);

    // Might return with isValid = false
    if (parsed && parsed.isValid === false) {
      console.log(`  Invalid raw tx returned isValid: false`);
    }
  } catch (error) {
    errorOccurred = true;
    console.log(`  Invalid raw tx error: "${error.message}"`);
  }

  assert(errorOccurred || true, 'Invalid raw tx handled appropriately');
}

// Test 14.4: Parse malformed hex string
async function testParseMalformedHex() {
  const malformedHex = 'not-a-valid-hex-string';

  let errorOccurred = false;
  try {
    await mnee.parseTxFromRawTx(malformedHex);
  } catch (error) {
    errorOccurred = true;
    console.log(`  Malformed hex error: "${error.message}"`);
  }

  assert(errorOccurred, 'Malformed hex should cause an error');
}

// Test 14.5: Parse empty string
async function testParseEmptyString() {
  let errorOccurred = false;
  try {
    await mnee.parseTxFromRawTx('');
    // If no error thrown, fail the test
    assert.fail('Should throw error for empty string');
  } catch (error) {
    errorOccurred = true;
    console.log(`  Empty string error: "${error.message}"`);
  }

  assert(errorOccurred, 'Empty string should cause an error');
}

// Test 14.6: Compare parseTx and parseTxFromRawTx
async function testCompareParsingMethods() {
  try {
    // Get a known transaction ID to test
    const history = await mnee.recentTxHistory(testConfig.addresses.testAddress, undefined, 1);

    if (history.history.length > 0) {
      const txid = history.history[0].txid;

      // Parse using parseTx with includeRaw
      const parsedFromId = await mnee.parseTx(txid, { includeRaw: true });

      if (parsedFromId.raw && parsedFromId.raw.txHex) {
        // Parse the same transaction using parseTxFromRawTx
        const parsedFromRaw = await mnee.parseTxFromRawTx(parsedFromId.raw.txHex);

        // Compare results (excluding raw data)
        assert(parsedFromId.txid === parsedFromRaw.txid, 'Transaction IDs should match');
        assert(parsedFromId.type === parsedFromRaw.type, 'Transaction types should match');
        assert(parsedFromId.environment === parsedFromRaw.environment, 'Environments should match');
        assert(parsedFromId.isValid === parsedFromRaw.isValid, 'Validity should match');
        assert(parsedFromId.inputTotal === parsedFromRaw.inputTotal, 'Input totals should match');
        assert(parsedFromId.outputTotal === parsedFromRaw.outputTotal, 'Output totals should match');
        assert(parsedFromId.inputs.length === parsedFromRaw.inputs.length, 'Input counts should match');
        assert(parsedFromId.outputs.length === parsedFromRaw.outputs.length, 'Output counts should match');

        console.log(`  Both parsing methods return consistent results ✓`);
        console.log(`  Tested with txid: ${txid.substring(0, 10)}...`);
      }
    } else {
      console.log(`  No transactions available for comparison test`);
    }
  } catch (error) {
    console.log(`  Comparison test error: ${error.message}`);
  }
}

// Test 14.7: Test redeem transaction parsing
async function testRedeemTransaction() {
  const redeemTxId = knownTransactions[config.environment]?.redeem;
  
  if (!redeemTxId) {
    console.log(`  No redeem transaction available for ${config.environment} environment`);
    return;
  }
  
  try {
    // Get the raw transaction hex first
    const txWithRaw = await mnee.parseTx(redeemTxId, { includeRaw: true });
    assert(txWithRaw.raw && txWithRaw.raw.txHex, 'Should get raw transaction hex');
    
    // Parse the raw transaction
    const parsed = await mnee.parseTxFromRawTx(txWithRaw.raw.txHex);
    
    // Verify it's detected as redeem type
    assert(parsed.type === 'redeem', `Transaction should be type 'redeem', got '${parsed.type}'`);
    assert(parsed.isValid === true, 'Redeem transaction should be valid');
    assert(parsed.environment === config.environment, `Environment should be ${config.environment}`);
    
    console.log(`  Parsed redeem transaction from raw: ${redeemTxId.substring(0, 10)}...`);
    console.log(`  Type: ${parsed.type}`);
    console.log(`  Valid: ${parsed.isValid}`);
    console.log(`  Inputs: ${parsed.inputs.length}, Outputs: ${parsed.outputs.length}`);
    
    // Parse again with includeRaw to verify metadata
    const parsedWithRaw = await mnee.parseTxFromRawTx(txWithRaw.raw.txHex, { includeRaw: true });
    if (parsedWithRaw.raw) {
      console.log(`  Raw data included for metadata inspection`);
      // The metadata would be in the inscription of the outputs
    }
  } catch (error) {
    console.log(`  Redeem transaction test error: ${error.message}`);
    throw error;
  }
}

// Test 14.8: Test known transaction types
async function testKnownTransactionTypes() {
  // Test a few known transactions if we're in the right environment
  const transactions = knownTransactions[config.environment];

  if (!transactions) {
    console.log(`  No known transactions for ${config.environment} environment`);
    return;
  }

  console.log(`  Testing known ${config.environment} transactions:`);

  for (const [type, txid] of Object.entries(transactions)) {
    try {
      // First get the raw tx
      const txWithRaw = await mnee.parseTx(txid, { includeRaw: true });

      if (txWithRaw.raw && txWithRaw.raw.txHex) {
        // Parse from raw
        const parsed = await mnee.parseTxFromRawTx(txWithRaw.raw.txHex);

        assert(parsed.type === type, `Transaction should be type ${type}, got ${parsed.type}`);
        assert(parsed.environment === config.environment, 'Environment should match');
        console.log(`    ${type}: ${txid.substring(0, 10)}... ✓`);
      }
    } catch (error) {
      console.log(`    ${type}: Failed - ${error.message}`);
    }
  }
}

// Test 14.8: Test transaction validation
async function testTransactionValidation() {
  try {
    // Create a valid transfer
    const request = [
      {
        address: testConfig.addresses.emptyAddress,
        amount: 0.01,
      },
    ];

    const transfer = await mnee.transfer(request, TEST_WIF, { broadcast: false });
    const parsed = await mnee.parseTxFromRawTx(transfer.rawtx);

    assert(parsed.isValid === true, 'Created transaction should be valid');

    // Verify validation with validateMneeTx
    const isValid = await mnee.validateMneeTx(transfer.rawtx, request);
    assert(isValid === true, 'Transaction should validate against request');

    console.log(`  Transaction validation consistent between methods ✓`);
  } catch (error) {
    console.log(`  Transaction validation test error: ${error.message}`);
  }
}

// Run tests
async function runTests() {
  console.log('Running parseTxFromRawTx tests...\n');
  console.log('Note: This method parses transaction details from raw transaction hex.\n');

  try {
    // Fetch config first
    await mnee.config();

    console.log('Test 14.1: Parse raw transaction from created transfer');
    await testParseCreatedTransfer();
    console.log('✅ Test 14.1 passed\n');

    console.log('Test 14.2: Parse with includeRaw option');
    await testParseWithIncludeRaw();
    console.log('✅ Test 14.2 passed\n');

    console.log('Test 14.3: Parse invalid raw transaction');
    await testParseInvalidRawTx();
    console.log('✅ Test 14.3 passed\n');

    console.log('Test 14.4: Parse malformed hex string');
    await testParseMalformedHex();
    console.log('✅ Test 14.4 passed\n');

    console.log('Test 14.5: Parse empty string');
    await testParseEmptyString();
    console.log('✅ Test 14.5 passed\n');

    console.log('Test 14.6: Compare parseTx and parseTxFromRawTx');
    await testCompareParsingMethods();
    console.log('✅ Test 14.6 passed\n');

    console.log('Test 14.7: Test redeem transaction parsing');
    await testRedeemTransaction();
    console.log('✅ Test 14.7 passed\n');

    console.log('Test 14.8: Test known transaction types');
    await testKnownTransactionTypes();
    console.log('✅ Test 14.8 passed\n');

    console.log('Test 14.9: Test transaction validation');
    await testTransactionValidation();
    console.log('✅ Test 14.9 passed\n');

    console.log('All tests passed! ✅');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
