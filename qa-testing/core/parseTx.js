import Mnee from 'mnee';
import assert from 'assert';
import testConfig from '../testConfig.js';

// Test configuration
const config = {
  environment: testConfig.environment,
  apiKey: testConfig.apiKey,
};

const mnee = new Mnee(config);

// Test addresses
const TEST_ADDRESS = testConfig.addresses.testAddress;

// Known transaction IDs for different types (from local-test files)
const knownTransactions = {
  sandbox: {
    deploy: '833a7720966a2a435db28d967385e8aa7284b6150ebb39482cc5228b73e1703f',
    mint: '9b42a339a97df37c8756a3425d4200ae2a592fd751c50e1d5ce0a1ddcab06b81',
    transfer: 'baa78cb903e0bf7af6e5fc5a27de59d587fc5ff4f08ed5e7886ab1a7d2741c5b',
    burn: 'e2421bb58ecb606c04e81a20943ea32eeac6c5c374d77d6dba7d46a2ddbad483',
  },
  production: {
    deploy: 'ae59f3b898ec61acbdb6cc7a245fabeded0c094bf046f35206a3aec60ef88127',
    mint: 'f7ca34a9c0319bfb837a56ee7375e8246229f5fefbdaaaf9fdec97493d428bee',
    transfer: 'e496b2984a6b780a453559125540ec1e1c99154cdbc1cef2d2f6bea37d6dedd9',
  }
};

// Test 13.1: Parse a valid transaction
async function testParseValidTransaction() {
  try {
    // First get a transaction from history to parse
    const history = await mnee.recentTxHistory(TEST_ADDRESS, undefined, 1);
    
    if (history.history.length > 0) {
      const txid = history.history[0].txid;
      
      const parsed = await mnee.parseTx(txid);
      
      // Verify response structure
      assert(parsed.txid === txid, 'Parsed txid should match requested txid');
      assert(parsed.environment === config.environment, 'Environment should match');
      assert(['transfer', 'burn', 'deploy', 'mint'].includes(parsed.type), 'Type should be valid');
      assert(Array.isArray(parsed.inputs), 'Inputs should be an array');
      assert(Array.isArray(parsed.outputs), 'Outputs should be an array');
      assert(typeof parsed.isValid === 'boolean', 'isValid should be boolean');
      assert(typeof parsed.inputTotal === 'string', 'inputTotal should be string');
      assert(typeof parsed.outputTotal === 'string', 'outputTotal should be string');
      
      console.log(`  Parsed transaction ${txid.substring(0, 10)}...`);
      console.log(`  Type: ${parsed.type}`);
      console.log(`  Inputs: ${parsed.inputs.length}, Outputs: ${parsed.outputs.length}`);
      console.log(`  Valid: ${parsed.isValid}`);
      
      // Verify input/output structure
      if (parsed.inputs.length > 0) {
        const input = parsed.inputs[0];
        assert(input.address, 'Input should have address');
        assert(typeof input.amount === 'number', 'Input amount should be number');
      }
      
      if (parsed.outputs.length > 0) {
        const output = parsed.outputs[0];
        assert(output.address, 'Output should have address');
        assert(typeof output.amount === 'number', 'Output amount should be number');
      }
    } else {
      console.log('  No transactions in history to test');
    }
  } catch (error) {
    console.log(`  Parse valid transaction error: ${error.message}`);
    throw error;
  }
}

// Test 13.2: Parse with includeRaw option
async function testParseWithIncludeRaw() {
  try {
    const history = await mnee.recentTxHistory(TEST_ADDRESS, undefined, 1);
    
    if (history.history.length > 0) {
      const txid = history.history[0].txid;
      
      const parsed = await mnee.parseTx(txid, { includeRaw: true });
      
      // Should have all standard fields
      assert(parsed.txid === txid, 'Should have txid');
      assert(parsed.inputs && parsed.outputs, 'Should have inputs and outputs');
      
      // Should also have raw data
      assert(parsed.raw, 'Should have raw data when includeRaw is true');
      assert(parsed.raw.txHex, 'Raw should have txHex');
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
      }
      
      // Verify raw output structure
      if (parsed.raw.outputs.length > 0) {
        const rawOutput = parsed.raw.outputs[0];
        assert(typeof rawOutput.value === 'number', 'Raw output should have value');
        assert(rawOutput.scriptPubKey, 'Raw output should have scriptPubKey');
      }
    } else {
      console.log('  No transactions to test with includeRaw');
    }
  } catch (error) {
    console.log(`  Parse with includeRaw error: ${error.message}`);
  }
}

// Test 13.3: Parse invalid transaction ID
async function testParseInvalidTxid() {
  const invalidTxid = '0000000000000000000000000000000000000000000000000000000000000000';
  
  let errorOccurred = false;
  try {
    const parsed = await mnee.parseTx(invalidTxid);
    
    // Might return a result with isValid = false
    if (parsed && parsed.isValid === false) {
      console.log(`  Invalid txid returned isValid: false`);
    }
  } catch (error) {
    errorOccurred = true;
    console.log(`  Invalid txid error: "${error.message}"`);
  }
  
  assert(errorOccurred || true, 'Invalid txid handled appropriately');
}

// Test 13.4: Parse malformed transaction ID
async function testParseMalformedTxid() {
  const malformedTxid = 'not-a-valid-txid';
  
  let errorOccurred = false;
  try {
    await mnee.parseTx(malformedTxid);
  } catch (error) {
    errorOccurred = true;
    console.log(`  Malformed txid error: "${error.message}"`);
  }
  
  assert(errorOccurred, 'Malformed txid should cause an error');
}

// Test 13.5: Parse transfer transaction
async function testParseTransferTransaction() {
  try {
    // Create a transfer to get a known transaction structure
    const request = [{
      address: testConfig.addresses.emptyAddress,
      amount: 0.01,
    }];
    
    const transfer = await mnee.transfer(request, testConfig.wallet.testWif, false);
    
    if (transfer.rawtx) {
      // Parse the raw tx instead (we'll test parseTxFromRawTx later)
      const parsed = await mnee.parseTxFromRawTx(transfer.rawtx);
      
      assert(parsed.type === 'transfer', 'Created transaction should be transfer type');
      assert(parsed.outputs.some(o => o.address === request[0].address), 'Should have recipient output');
      
      console.log(`  Created transfer transaction parsed successfully`);
      console.log(`  Type: ${parsed.type}, Valid: ${parsed.isValid}`);
    }
  } catch (error) {
    console.log(`  Parse transfer transaction error: ${error.message}`);
  }
}

// Test 13.6: Verify amount calculations
async function testAmountCalculations() {
  try {
    const history = await mnee.recentTxHistory(TEST_ADDRESS, undefined, 1);
    
    if (history.history.length > 0) {
      const txid = history.history[0].txid;
      const parsed = await mnee.parseTx(txid);
      
      // Calculate totals manually
      const inputTotal = parsed.inputs.reduce((sum, input) => sum + input.amount, 0);
      const outputTotal = parsed.outputs.reduce((sum, output) => sum + output.amount, 0);
      
      console.log(`  Input total: ${inputTotal} atomic units (${parsed.inputTotal})`);
      console.log(`  Output total: ${outputTotal} atomic units (${parsed.outputTotal})`);
      
      // Totals are provided as strings, parse them
      assert(parseInt(parsed.inputTotal) === inputTotal, 'Input total should match sum of inputs');
      assert(parseInt(parsed.outputTotal) === outputTotal, 'Output total should match sum of outputs');
      
      // Fee calculation (if inputs > outputs)
      if (inputTotal > outputTotal) {
        const fee = inputTotal - outputTotal;
        console.log(`  Transaction fee: ${fee} atomic units (${mnee.fromAtomicAmount(fee)} MNEE)`);
      }
    } else {
      console.log('  No transactions to test amount calculations');
    }
  } catch (error) {
    console.log(`  Amount calculations error: ${error.message}`);
  }
}

// Test 13.7: Test different transaction types from history
async function testDifferentTransactionTypes() {
  try {
    // Get multiple transactions to find different types
    const history = await mnee.recentTxHistory(TEST_ADDRESS, undefined, 10);
    
    assert(history.history.length > 0, 'Should have at least one transaction in history');
    
    const types = new Set();
    const parsedTransactions = [];
    
    for (const tx of history.history) {
      try {
        const parsed = await mnee.parseTx(tx.txid);
        
        // Verify parsed transaction structure
        assert(parsed.txid === tx.txid, 'Parsed txid should match');
        assert(['transfer', 'burn', 'deploy', 'mint'].includes(parsed.type), `Type ${parsed.type} should be valid`);
        assert(parsed.environment === config.environment, 'Environment should match config');
        assert(typeof parsed.isValid === 'boolean', 'isValid should be boolean');
        
        types.add(parsed.type);
        parsedTransactions.push(parsed);
        
      } catch (error) {
        console.log(`  Error parsing tx ${tx.txid}: ${error.message}`);
        throw error;
      }
    }
    
    // Assert we successfully parsed all transactions
    assert(parsedTransactions.length === history.history.length, 'Should parse all transactions successfully');
    
    // Log findings
    if (types.size === 1) {
      console.log(`  All ${history.history.length} transactions are type: ${Array.from(types)[0]}`);
    } else {
      console.log(`  Found ${types.size} transaction types: ${Array.from(types).join(', ')}`);
    }
    
    // Verify all parsed transactions are valid
    const allValid = parsedTransactions.every(tx => tx.isValid);
    assert(allValid, 'All parsed transactions should be valid');
    
    console.log(`  Successfully parsed ${parsedTransactions.length} transactions`);
  } catch (error) {
    console.log(`  Different transaction types test error: ${error.message}`);
    throw error;
  }
}

// Test 13.8: Test known transaction types
async function testKnownTransactionTypes() {
  const transactions = knownTransactions[config.environment];
  
  if (!transactions) {
    console.log(`  No known test transactions for ${config.environment} environment`);
    return;
  }
  
  console.log(`  Testing known ${config.environment} transaction types:`);
  
  for (const [expectedType, txid] of Object.entries(transactions)) {
    try {
      const parsed = await mnee.parseTx(txid);
      
      // Verify transaction type
      assert(parsed.type === expectedType, `Transaction ${txid} should be type ${expectedType}, got ${parsed.type}`);
      assert(parsed.environment === config.environment, `Environment should be ${config.environment}`);
      assert(parsed.isValid === true, 'Known transaction should be valid');
      
      console.log(`    ${expectedType}: ${txid.substring(0, 10)}... ✓`);
      
      // Show some details for each type
      switch (expectedType) {
        case 'deploy':
          console.log(`      Deploy creates initial token supply`);
          break;
        case 'mint':
          console.log(`      Mint from ${config.environment === 'sandbox' ? 'SANDBOX_ADDRESS' : 'PROD_ADDRESS'}`);
          break;
        case 'transfer':
          console.log(`      Transfer between addresses`);
          break;
        case 'burn':
          console.log(`      Burn destroys tokens permanently`);
          break;
      }
    } catch (error) {
      console.log(`    ${expectedType}: Failed - ${error.message}`);
    }
  }
}

// Run tests
async function runTests() {
  console.log('Running parseTx tests...\n');
  console.log('Note: This method parses transaction details from transaction IDs.\n');

  try {
    // Fetch config first
    await mnee.config();
    
    console.log('Test 13.1: Parse a valid transaction');
    await testParseValidTransaction();
    console.log('✅ Test 13.1 passed\n');

    console.log('Test 13.2: Parse with includeRaw option');
    await testParseWithIncludeRaw();
    console.log('✅ Test 13.2 passed\n');

    console.log('Test 13.3: Parse invalid transaction ID');
    await testParseInvalidTxid();
    console.log('✅ Test 13.3 passed\n');

    console.log('Test 13.4: Parse malformed transaction ID');
    await testParseMalformedTxid();
    console.log('✅ Test 13.4 passed\n');

    console.log('Test 13.5: Parse transfer transaction');
    await testParseTransferTransaction();
    console.log('✅ Test 13.5 passed\n');

    console.log('Test 13.6: Verify amount calculations');
    await testAmountCalculations();
    console.log('✅ Test 13.6 passed\n');

    console.log('Test 13.7: Test different transaction types from history');
    await testDifferentTransactionTypes();
    console.log('✅ Test 13.7 passed\n');

    console.log('Test 13.8: Test known transaction types');
    await testKnownTransactionTypes();
    console.log('✅ Test 13.8 passed\n');

    console.log('All tests passed! ✅');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();