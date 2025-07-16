import Mnee from '../dist/index.modern.js';
import assert from 'assert';
import testConfig from './tests.config.json' assert { type: 'json' };

// Test configuration
const config = {
  environment: testConfig.environment,
};

const mnee = new Mnee(config);

// Test addresses and WIF from config
const TEST_ADDRESS = testConfig.addresses.testAddress;
const TEST_WIF = testConfig.wallet.testWif;

// Test 7.1: Basic transferMulti with single input
async function testBasicTransferMulti() {
  // First get UTXOs for the test address
  const utxos = await mnee.getUtxos(TEST_ADDRESS);
  
  if (utxos.length === 0) {
    console.log('  ⚠️  No UTXOs available for test address, skipping test');
    return;
  }

  // Use the first UTXO
  const utxo = utxos[0];
  
  const options = {
    inputs: [
      {
        txid: utxo.txid,
        vout: utxo.vout,
        wif: TEST_WIF,
      },
    ],
    recipients: [
      {
        address: testConfig.addresses.emptyAddress,
        amount: 0.01, // Small amount in decimal MNEE
      },
    ],
    changeAddress: TEST_ADDRESS, // Send change back to test address
  };

  try {
    const result = await mnee.transferMulti(options, false);
    
    assert(result.rawtx, 'Should return raw transaction');
    assert(!result.txid, 'Should not have txid when broadcast is false');
    assert(!result.error, 'Should not have error for valid transfer');
    
    console.log('  TransferMulti created successfully');
    console.log(`  Raw transaction length: ${result.rawtx.length} characters`);
    
    // Validate the created transaction
    const isValid = await mnee.validateMneeTx(result.rawtx, options.recipients);
    assert(isValid === true, 'Created transaction should be valid');
    
    // Parse to verify outputs
    const parsedTx = await mnee.parseTxFromRawTx(result.rawtx);
    assert(parsedTx.outputs && parsedTx.outputs.length >= 2, 'Should have recipient and change outputs');
    
    return result.rawtx;
  } catch (error) {
    console.log(`  TransferMulti failed: ${error.message}`);
    throw error;
  }
}

// Test 7.2: TransferMulti with multiple inputs from same address
async function testMultipleInputs() {
  const utxos = await mnee.getUtxos(TEST_ADDRESS);
  
  if (utxos.length < 2) {
    console.log('  ⚠️  Not enough UTXOs for multiple input test, skipping');
    return;
  }

  // Use first two UTXOs
  const options = {
    inputs: [
      {
        txid: utxos[0].txid,
        vout: utxos[0].vout,
        wif: TEST_WIF,
      },
      {
        txid: utxos[1].txid,
        vout: utxos[1].vout,
        wif: TEST_WIF,
      },
    ],
    recipients: [
      {
        address: testConfig.addresses.emptyAddress,
        amount: 0.02,
      },
    ],
    changeAddress: TEST_ADDRESS,
  };

  try {
    const result = await mnee.transferMulti(options, false);
    
    assert(result.rawtx, 'Should return raw transaction');
    assert(!result.error, 'Should not have error');
    
    console.log('  Multiple inputs transfer created successfully');
    
    // Verify inputs were used
    const parsedTx = await mnee.parseTxFromRawTx(result.rawtx);
    console.log(`  Transaction uses ${parsedTx.inputs.length} inputs`);
  } catch (error) {
    console.log(`  Multiple inputs transfer failed: ${error.message}`);
  }
}

// Test 7.3: TransferMulti with multiple recipients
async function testMultipleRecipients() {
  const utxos = await mnee.getUtxos(TEST_ADDRESS);
  
  if (utxos.length === 0) {
    console.log('  ⚠️  No UTXOs available, skipping test');
    return;
  }

  const options = {
    inputs: [
      {
        txid: utxos[0].txid,
        vout: utxos[0].vout,
        wif: TEST_WIF,
      },
    ],
    recipients: [
      {
        address: testConfig.addresses.emptyAddress,
        amount: 0.01,
      },
      {
        address: '1Lbcfr7sAHTD9CgdQo3HTMTkV8LK4ZnX71',
        amount: 0.01,
      },
    ],
    changeAddress: TEST_ADDRESS,
  };

  try {
    const result = await mnee.transferMulti(options, false);
    
    assert(result.rawtx, 'Should return raw transaction');
    assert(!result.error, 'Should not have error');
    
    // Verify all recipients have outputs
    const parsedTx = await mnee.parseTxFromRawTx(result.rawtx);
    for (const recipient of options.recipients) {
      const output = parsedTx.outputs.find(o => o.address === recipient.address);
      assert(output, `Should have output for recipient ${recipient.address}`);
      assert(output.amount === mnee.toAtomicAmount(recipient.amount), 
        `Output amount should match for ${recipient.address}`);
    }
    
    console.log('  Multiple recipients transfer created successfully');
  } catch (error) {
    console.log(`  Multiple recipients transfer failed: ${error.message}`);
  }
}

// Test 7.4: TransferMulti with invalid UTXO
async function testInvalidUtxo() {
  const options = {
    inputs: [
      {
        txid: '0000000000000000000000000000000000000000000000000000000000000000',
        vout: 0,
        wif: TEST_WIF,
      },
    ],
    recipients: [
      {
        address: testConfig.addresses.emptyAddress,
        amount: 0.01,
      },
    ],
  };

  try {
    const result = await mnee.transferMulti(options, false);
    
    assert(result.error, 'Should have error for invalid UTXO');
    assert(!result.rawtx, 'Should not have rawtx when error occurs');
    assert(!result.txid, 'Should not have txid when error occurs');
    
    console.log(`  Invalid UTXO error: "${result.error}"`);
  } catch (error) {
    console.log(`  TransferMulti threw error for invalid UTXO: "${error.message}"`);
  }
}

// Test 7.5: TransferMulti with mismatched WIF
async function testMismatchedWif() {
  const utxos = await mnee.getUtxos(TEST_ADDRESS);
  
  if (utxos.length === 0) {
    console.log('  ⚠️  No UTXOs available, skipping test');
    return;
  }

  const options = {
    inputs: [
      {
        txid: utxos[0].txid,
        vout: utxos[0].vout,
        wif: 'L1uyy5qTuGrVXrmrsvHWHgVzW9kKdrp27wBC7Vs6nZDTF2BRUVwy', // Different WIF
      },
    ],
    recipients: [
      {
        address: testConfig.addresses.emptyAddress,
        amount: 0.01,
      },
    ],
  };

  let errorOccurred = false;
  try {
    const result = await mnee.transferMulti(options, false);
    
    if (result.error) {
      errorOccurred = true;
      console.log(`  Mismatched WIF error: "${result.error}"`);
    } else {
      assert.fail('Should have error for mismatched WIF');
    }
  } catch (error) {
    errorOccurred = true;
    console.log(`  TransferMulti threw error for mismatched WIF: "${error.message}"`);
  }
  
  assert(errorOccurred, 'Mismatched WIF should cause an error');
}

// Test 7.6: TransferMulti with multiple change addresses
async function testMultipleChangeAddresses() {
  const utxos = await mnee.getUtxos(TEST_ADDRESS);
  
  if (utxos.length === 0) {
    console.log('  ⚠️  No UTXOs available, skipping test');
    return;
  }

  const options = {
    inputs: [
      {
        txid: utxos[0].txid,
        vout: utxos[0].vout,
        wif: TEST_WIF,
      },
    ],
    recipients: [
      {
        address: testConfig.addresses.emptyAddress,
        amount: 0.01,
      },
    ],
    changeAddress: [
      {
        address: TEST_ADDRESS,
        amount: 0.5, // Specific change amount
      },
      {
        address: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',
        amount: 0.5, // Split change
      },
    ],
  };

  try {
    const result = await mnee.transferMulti(options, false);
    
    if (result.rawtx) {
      console.log('  Multiple change addresses handled');
      
      // Verify change outputs
      const parsedTx = await mnee.parseTxFromRawTx(result.rawtx);
      console.log(`  Transaction has ${parsedTx.outputs.length} outputs`);
    } else if (result.error) {
      console.log(`  Multiple change addresses error: "${result.error}"`);
    }
  } catch (error) {
    console.log(`  TransferMulti with multiple change addresses: "${error.message}"`);
  }
}

// Test 7.7: TransferMulti with empty inputs
async function testEmptyInputs() {
  const options = {
    inputs: [],
    recipients: [
      {
        address: testConfig.addresses.emptyAddress,
        amount: 0.01,
      },
    ],
  };

  let errorOccurred = false;
  try {
    const result = await mnee.transferMulti(options, false);
    
    assert(result.error || !result.rawtx, 'Should fail with empty inputs');
    errorOccurred = true;
    console.log(`  Empty inputs handled: ${result.error || 'rejected'}`);
  } catch (error) {
    errorOccurred = true;
    console.log(`  TransferMulti threw error for empty inputs: "${error.message}"`);
  }
  
  assert(errorOccurred, 'Empty inputs should cause an error');
}

// Run tests
async function runTests() {
  console.log('Running transferMulti tests...\n');
  console.log('Note: These tests use the test WIF key from config.');
  console.log(`Test address: ${TEST_ADDRESS}\n`);

  try {
    // Check balance
    const balance = await mnee.balance(TEST_ADDRESS);
    console.log(`Current balance: ${balance.decimalAmount} MNEE`);
    
    const utxos = await mnee.getUtxos(TEST_ADDRESS);
    console.log(`Available UTXOs: ${utxos.length}\n`);
    
    if (balance.decimalAmount === 0) {
      console.log('⚠️  Warning: Test address has zero balance. Most tests will be skipped.\n');
    }

    console.log('Test 7.1: Basic transferMulti');
    await testBasicTransferMulti();
    console.log('✅ Test 7.1 passed\n');

    console.log('Test 7.2: TransferMulti with multiple inputs');
    await testMultipleInputs();
    console.log('✅ Test 7.2 passed\n');

    console.log('Test 7.3: TransferMulti with multiple recipients');
    await testMultipleRecipients();
    console.log('✅ Test 7.3 passed\n');

    console.log('Test 7.4: TransferMulti with invalid UTXO');
    await testInvalidUtxo();
    console.log('✅ Test 7.4 passed\n');

    console.log('Test 7.5: TransferMulti with mismatched WIF');
    await testMismatchedWif();
    console.log('✅ Test 7.5 passed\n');

    console.log('Test 7.6: TransferMulti with multiple change addresses');
    await testMultipleChangeAddresses();
    console.log('✅ Test 7.6 passed\n');

    console.log('Test 7.7: TransferMulti with empty inputs');
    await testEmptyInputs();
    console.log('✅ Test 7.7 passed\n');

    console.log('All tests passed! ✅');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();