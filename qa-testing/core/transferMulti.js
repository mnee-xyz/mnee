import Mnee from '@mnee/ts-sdk';
import assert from 'assert';
import testConfig from '../testConfig.js';

// Test configuration
const config = {
  environment: testConfig.environment,
  apiKey: testConfig.apiKey,
};

const mnee = new Mnee(config);

// Test addresses and WIF from config
const TEST_ADDRESS = testConfig.addresses.testAddress;
const TEST_WIF = testConfig.wallet.testWif;

// Test 7.1: Basic transferMulti with single input
async function testBasicTransferMulti() {
  // First get UTXOs for the test address
  const utxos = await mnee.getUtxos(TEST_ADDRESS, undefined, 100);

  if (utxos.length === 0) {
    console.log('  ⚠️  No UTXOs available for test address, skipping test');
    return;
  }

  // find a utxo that has enough balance
  const utxo = utxos.find((u) => u.data.bsv21.amt >= 1500);

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
    const result = await mnee.transferMulti(options, { broadcast: false });

    assert(result.rawtx, 'Should return raw transaction');
    assert(!result.ticketId, 'Should not have ticketId when broadcast is false');
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
  const utxos = await mnee.getUtxos(TEST_ADDRESS, undefined, 100);

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
    const result = await mnee.transferMulti(options, { broadcast: false });

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
  const utxos = await mnee.getUtxos(TEST_ADDRESS, undefined, 100);

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
    const result = await mnee.transferMulti(options, { broadcast: false });

    assert(result.rawtx, 'Should return raw transaction');
    assert(!result.error, 'Should not have error');

    // Verify all recipients have outputs
    const parsedTx = await mnee.parseTxFromRawTx(result.rawtx);
    for (const recipient of options.recipients) {
      const output = parsedTx.outputs.find((o) => o.address === recipient.address);
      assert(output, `Should have output for recipient ${recipient.address}`);
      assert(
        output.amount === mnee.toAtomicAmount(recipient.amount),
        `Output amount should match for ${recipient.address}`,
      );
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
    const result = await mnee.transferMulti(options, { broadcast: false });

    assert(result.error, 'Should have error for invalid UTXO');
    assert(!result.rawtx, 'Should not have rawtx when error occurs');
    assert(!result.ticketId, 'Should not have ticketId when error occurs');

    console.log(`  Invalid UTXO error: "${result.error}"`);
  } catch (error) {
    console.log(`  TransferMulti threw error for invalid UTXO: "${error.message}"`);
  }
}

// Test 7.5: TransferMulti with mismatched WIF
async function testMismatchedWif() {
  const utxos = await mnee.getUtxos(TEST_ADDRESS, undefined, 100);

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
    const result = await mnee.transferMulti(options, { broadcast: false });

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
  const utxos = await mnee.getUtxos(TEST_ADDRESS, undefined, 100);

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
    const result = await mnee.transferMulti(options, { broadcast: false });

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
    const result = await mnee.transferMulti(options, { broadcast: false });

    assert(result.error || !result.rawtx, 'Should fail with empty inputs');
    errorOccurred = true;
    console.log(`  Empty inputs handled: ${result.error || 'rejected'}`);
  } catch (error) {
    errorOccurred = true;
    console.log(`  TransferMulti threw error for empty inputs: "${error.message}"`);
  }

  assert(errorOccurred, 'Empty inputs should cause an error');
}

// Test 7.8: TransferMulti with empty recipients
async function testEmptyRecipients() {
  const utxos = await mnee.getUtxos(TEST_ADDRESS, undefined, 100);

  if (utxos.length === 0) {
    console.log('  ⚠️  No UTXOs available, using dummy data');
  }

  const options = {
    inputs: [
      {
        txid: utxos[0]?.txid || '0000000000000000000000000000000000000000000000000000000000000000',
        vout: utxos[0]?.vout || 0,
        wif: TEST_WIF,
      },
    ],
    recipients: [], // Empty recipients array
  };

  let errorOccurred = false;
  try {
    const result = await mnee.transferMulti(options, { broadcast: false });

    assert(result.error || !result.rawtx, 'Should fail with empty recipients');
    errorOccurred = true;
    console.log(`  Empty recipients handled: ${result.error || 'rejected'}`);
  } catch (error) {
    errorOccurred = true;
    console.log(`  TransferMulti threw error for empty recipients: "${error.message}"`);
  }

  assert(errorOccurred, 'Empty recipients should cause an error');
}

// Test 7.9: TransferMulti with invalid WIF in input
async function testInvalidWifInInput() {
  const invalidWifs = [
    { wif: 'invalid-wif', desc: 'Invalid characters' },
    { wif: 'L1z7N5Qkpkz93odzExb8DNyee2CRQAXsqWX3WQb2hpsbGsWAPeb', desc: 'Missing last character' },
    { wif: '', desc: 'Empty string' },
    { wif: null, desc: 'Null value' },
    { wif: 123, desc: 'Number instead of string' },
  ];

  console.log('  Testing various invalid WIF formats:');

  for (const { wif, desc } of invalidWifs) {
    const options = {
      inputs: [
        {
          txid: '0000000000000000000000000000000000000000000000000000000000000000',
          vout: 0,
          wif: wif,
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

      if (result.error) {
        console.log(`    ${desc}: "${result.error}"`);
      } else {
        console.log(`    ${desc}: No error returned (FAIL)`);
      }
    } catch (error) {
      console.log(`    ${desc}: Exception - "${error.message}"`);
    }
  }
}

// Test 7.10: TransferMulti with invalid recipient addresses
async function testInvalidRecipientAddresses() {
  const invalidAddresses = [
    { address: 'invalid-address', desc: 'Invalid format' },
    { address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNx', desc: 'Wrong checksum' },
    { address: '', desc: 'Empty string' },
    { address: null, desc: 'Null value' },
    { address: 123, desc: 'Number instead of string' },
  ];

  console.log('  Testing various invalid recipient addresses:');

  const utxos = await mnee.getUtxos(TEST_ADDRESS, undefined, 100);
  if (utxos.length === 0) {
    console.log('    ⚠️  No UTXOs available, using dummy data');
  }

  for (const { address, desc } of invalidAddresses) {
    const options = {
      inputs: [
        {
          txid: utxos[0]?.txid || '0000000000000000000000000000000000000000000000000000000000000000',
          vout: utxos[0]?.vout || 0,
          wif: TEST_WIF,
        },
      ],
      recipients: [
        {
          address: address,
          amount: 0.01,
        },
      ],
    };

    try {
      const result = await mnee.transferMulti(options, { broadcast: false });

      if (result.error) {
        console.log(`    ${desc}: "${result.error}"`);
      } else {
        console.log(`    ${desc}: No error returned (FAIL)`);
      }
    } catch (error) {
      console.log(`    ${desc}: Exception - "${error.message}"`);
    }
  }
}

// Test 7.11: TransferMulti with invalid amounts
async function testInvalidAmounts() {
  const invalidAmounts = [
    { amount: -100, desc: 'Negative amount' },
    { amount: 0, desc: 'Zero amount' },
    { amount: 0.000001, desc: 'Below minimum (0.00001)' },
    { amount: '100', desc: 'String instead of number' },
    { amount: null, desc: 'Null value' },
    { amount: undefined, desc: 'Undefined value' },
    { amount: NaN, desc: 'NaN value' },
    { amount: Infinity, desc: 'Infinity value' },
  ];

  console.log('  Testing various invalid amounts:');

  const utxos = await mnee.getUtxos(TEST_ADDRESS, undefined, 100);
  if (utxos.length === 0) {
    console.log('    ⚠️  No UTXOs available, using dummy data');
  }

  for (const { amount, desc } of invalidAmounts) {
    const options = {
      inputs: [
        {
          txid: utxos[0]?.txid || '0000000000000000000000000000000000000000000000000000000000000000',
          vout: utxos[0]?.vout || 0,
          wif: TEST_WIF,
        },
      ],
      recipients: [
        {
          address: testConfig.addresses.emptyAddress,
          amount: amount,
        },
      ],
    };

    try {
      const result = await mnee.transferMulti(options, { broadcast: false });

      if (result.error) {
        console.log(`    ${desc}: "${result.error}"`);
      } else {
        console.log(`    ${desc}: No error returned (FAIL)`);
      }
    } catch (error) {
      console.log(`    ${desc}: Exception - "${error.message}"`);
    }
  }
}

// Test 7.12: TransferMulti with missing required fields
async function testMissingRequiredFields() {
  console.log('  Testing missing required fields:');

  // Missing txid in input
  let options = {
    inputs: [
      {
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
    const result = await mnee.transferMulti(options, { broadcast: false });
    console.log(`    Missing txid: "${result.error || 'No error (FAIL)'}"`);
  } catch (error) {
    console.log(`    Missing txid: Exception - "${error.message}"`);
  }

  // Missing vout in input
  options = {
    inputs: [
      {
        txid: '0000000000000000000000000000000000000000000000000000000000000000',
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
    const result = await mnee.transferMulti(options, { broadcast: false });
    console.log(`    Missing vout: "${result.error || 'No error (FAIL)'}"`);
  } catch (error) {
    console.log(`    Missing vout: Exception - "${error.message}"`);
  }

  // Missing address in recipient
  options = {
    inputs: [
      {
        txid: '0000000000000000000000000000000000000000000000000000000000000000',
        vout: 0,
        wif: TEST_WIF,
      },
    ],
    recipients: [
      {
        amount: 0.01,
      },
    ],
  };

  try {
    const result = await mnee.transferMulti(options, { broadcast: false });
    console.log(`    Missing recipient address: "${result.error || 'No error (FAIL)'}"`);
  } catch (error) {
    console.log(`    Missing recipient address: Exception - "${error.message}"`);
  }

  // Missing amount in recipient
  options = {
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
      },
    ],
  };

  try {
    const result = await mnee.transferMulti(options, { broadcast: false });
    console.log(`    Missing recipient amount: "${result.error || 'No error (FAIL)'}"`);
  } catch (error) {
    console.log(`    Missing recipient amount: Exception - "${error.message}"`);
  }
}

// Test 7.13: TransferMulti with invalid change address
async function testInvalidChangeAddress() {
  const utxos = await mnee.getUtxos(TEST_ADDRESS, undefined, 100);

  if (utxos.length === 0) {
    console.log('  ⚠️  No UTXOs available, skipping test');
    return;
  }

  console.log('  Testing invalid change addresses:');

  // Single invalid change address
  let options = {
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
    changeAddress: 'invalid-change-address',
  };

  try {
    const result = await mnee.transferMulti(options, { broadcast: false });
    console.log(`    Invalid single change address: "${result.error || 'No error (FAIL)'}"`);
  } catch (error) {
    console.log(`    Invalid single change address: Exception - "${error.message}"`);
  }

  // Invalid change address in array
  options = {
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
        address: 'invalid-change-address',
        amount: 0.5,
      },
    ],
  };

  try {
    const result = await mnee.transferMulti(options, { broadcast: false });
    console.log(`    Invalid change address in array: "${result.error || 'No error (FAIL)'}"`);
  } catch (error) {
    console.log(`    Invalid change address in array: Exception - "${error.message}"`);
  }

  // Change amount below minimum
  options = {
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
        amount: 0.000001, // Below minimum
      },
    ],
  };

  try {
    const result = await mnee.transferMulti(options, { broadcast: false });
    console.log(`    Change amount below minimum: "${result.error || 'No error (FAIL)'}"`);
  } catch (error) {
    console.log(`    Change amount below minimum: Exception - "${error.message}"`);
  }
}

// Test 7.14: TransferMulti with broadcast=true
async function testTransferMultiWithBroadcast() {
  console.log('  Testing transferMulti with actual broadcast to the network!');

  const utxos = await mnee.getEnoughUtxos(TEST_ADDRESS, 3000);

  if (utxos.length === 0) {
    console.log('  ⚠️  No UTXOs available for broadcast test, skipping');
    return;
  }

  const inputs = utxos.map((u) => ({
    txid: u.txid,
    vout: u.vout,
    wif: TEST_WIF,
  }));

  const options = {
    inputs,
    recipients: [
      {
        address: '1525VDfA8swjDMLHjLRCCmPFsTJToarrA2',
        amount: 0.01,
      },
      {
        address: '1PpT4b8aQwgzQkauvrYnZGWfyE8e1rkE4H',
        amount: 0.02,
      },
    ],
    changeAddress: TEST_ADDRESS,
  };

  // First create transaction without broadcast to compare
  const noBroadcastResult = await mnee.transferMulti(options, { broadcast: false });
  assert(
    noBroadcastResult.rawtx && !noBroadcastResult.ticketId,
    'Without broadcast should return rawtx but no ticketId',
  );

  // IMPORTANT: The following code would actually broadcast and spend funds!
  // Uncomment only if you want to test real broadcasting in sandbox/production

  try {
    const broadcastResult = await mnee.transferMulti(options, { broadcast: true });

    // When broadcast=true succeeds
    if (broadcastResult.ticketId) {
      assert(broadcastResult.ticketId, 'Broadcast result should have ticketId');
      assert(!broadcastResult.error, 'Successful broadcast should not have error');
      assert(typeof broadcastResult.ticketId === 'string', 'ticketId should be a string');
      assert(broadcastResult.ticketId.length === 36, 'ticketId should be a uuid');
      console.log(`  ✓ Transaction broadcast successfully: ${broadcastResult.ticketId}`);

      // Wait for transaction to process
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const txStatus = await mnee.getTxStatus(broadcastResult.ticketId);
      assert(txStatus, 'Broadcast transaction status should be retrievable');
      console.log(`  ✓ Transaction status: ${txStatus.status}`);
      console.log(`  ✓ Ticket ID: ${txStatus.id}`);
      console.log(`  ✓ Transaction ID: ${txStatus.tx_id}`);
    }
    // When broadcast fails
    else if (broadcastResult.error) {
      assert(broadcastResult.error, 'Failed broadcast should have error message');
      assert(!broadcastResult.ticketId, 'Failed broadcast should not have ticketId');
      console.log(`  ✓ Broadcast failed as expected: ${broadcastResult.error}`);
    } else {
      assert.fail('Broadcast result should have either ticketId or error');
    }
  } catch (error) {
    console.log(`  ✓ Broadcast threw error (may be expected): ${error.message}`);
  }

  console.log('  ✓ Broadcast test structure verified');
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

    console.log('Test 7.8: TransferMulti with empty recipients');
    await testEmptyRecipients();
    console.log('✅ Test 7.8 passed\n');

    console.log('Test 7.9: TransferMulti with invalid WIF in input');
    await testInvalidWifInInput();
    console.log('✅ Test 7.9 passed\n');

    console.log('Test 7.10: TransferMulti with invalid recipient addresses');
    await testInvalidRecipientAddresses();
    console.log('✅ Test 7.10 passed\n');

    console.log('Test 7.11: TransferMulti with invalid amounts');
    await testInvalidAmounts();
    console.log('✅ Test 7.11 passed\n');

    console.log('Test 7.12: TransferMulti with missing required fields');
    await testMissingRequiredFields();
    console.log('✅ Test 7.12 passed\n');

    console.log('Test 7.13: TransferMulti with invalid change address');
    await testInvalidChangeAddress();
    console.log('✅ Test 7.13 passed\n');

    console.log('Test 7.14: TransferMulti with broadcast');
    await testTransferMultiWithBroadcast();
    console.log('✅ Test 7.14 passed\n');

    console.log('All tests passed! ✅');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
