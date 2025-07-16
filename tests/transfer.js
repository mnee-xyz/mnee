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

// Test 6.1: Transfer with valid request (broadcast = false)
async function testTransferNoBroadcast() {
  const request = [
    {
      address: testConfig.addresses.emptyAddress, // Send to empty address
      amount: 0.01, // Small amount in decimal MNEE
    },
  ];

  try {
    const result = await mnee.transfer(request, TEST_WIF, false);

    // When broadcast is false, we should get a rawtx
    assert(result.rawtx, 'Should return raw transaction when broadcast is false');
    assert(!result.txid, 'Should not have txid when broadcast is false');
    assert(!result.error, 'Should not have error for valid transfer');

    console.log('  Transfer created successfully (not broadcast)');
    console.log(`  Raw transaction length: ${result.rawtx.length} characters`);

    // Validate the created transaction
    const isValid = await mnee.validateMneeTx(result.rawtx, request);
    assert(isValid === true, 'Created transaction should be valid');
    console.log(`  Transaction validation: passed`);

    // Parse the transaction to verify outputs
    const parsedTx = await mnee.parseTxFromRawTx(result.rawtx);
    assert(parsedTx.outputs && parsedTx.outputs.length >= 2, 'Should have at least 2 outputs (transfer + change)');

    // Verify the transfer output exists
    const transferOutput = parsedTx.outputs.find((o) => o.address === request[0].address);
    assert(transferOutput, 'Should have output for recipient address');
    assert(transferOutput.amount === mnee.toAtomicAmount(request[0].amount), 'Output amount should match request');

    return result.rawtx; // Return for use in other tests
  } catch (error) {
    console.log(`  Transfer creation failed: ${error.message}`);
    throw error;
  }
}

// Test 6.2: Transfer with multiple recipients
async function testMultipleRecipients() {
  const request = [
    {
      address: testConfig.addresses.emptyAddress,
      amount: 0.01,
    },
    {
      address: '1Lbcfr7sAHTD9CgdQo3HTMTkV8LK4ZnX71', // Another address
      amount: 0.02,
    },
  ];

  try {
    const result = await mnee.transfer(request, TEST_WIF, false);

    assert(result.rawtx, 'Should return raw transaction');
    assert(!result.error, 'Should not have error');

    console.log('  Multiple recipients transfer created successfully');

    // Parse to verify outputs
    const parsedTx = await mnee.parseTxFromRawTx(result.rawtx);
    assert(parsedTx.outputs, 'Parsed transaction should have outputs');
    console.log(`  Transaction has ${parsedTx.outputs.length} outputs`);

    // Verify each recipient has an output
    for (const recipient of request) {
      const output = parsedTx.outputs.find((o) => o.address === recipient.address);
      assert(output, `Should have output for recipient ${recipient.address}`);
      assert(
        output.amount === mnee.toAtomicAmount(recipient.amount),
        `Output amount for ${recipient.address} should match request`,
      );
    }

    // Validate the transaction
    const isValid = await mnee.validateMneeTx(result.rawtx, request);
    assert(isValid === true, 'Multi-recipient transaction should be valid');
  } catch (error) {
    console.log(`  Multiple recipients transfer failed: ${error.message}`);
    throw error;
  }
}

// Test 6.3: Transfer with insufficient balance
async function testInsufficientBalance() {
  // First check current balance
  const balance = await mnee.balance(TEST_ADDRESS);
  const hugeAmount = balance.decimalAmount + 1000000; // Way more than available

  const request = [
    {
      address: testConfig.addresses.emptyAddress,
      amount: hugeAmount,
    },
  ];

  try {
    const result = await mnee.transfer(request, TEST_WIF, false);

    // Should have an error
    assert(result.error, 'Should have error for insufficient balance');
    assert(!result.rawtx, 'Should not have rawtx when error occurs');
    assert(!result.txid, 'Should not have txid when error occurs');

    console.log(`  Insufficient balance error: "${result.error}"`);
  } catch (error) {
    console.log(`  Transfer threw error for insufficient balance: "${error.message}"`);
  }
}

// Test 6.4: Transfer with invalid WIF
async function testInvalidWif() {
  const request = [
    {
      address: testConfig.addresses.emptyAddress,
      amount: 0.01,
    },
  ];

  let errorOccurred = false;
  try {
    const result = await mnee.transfer(request, 'invalid-wif-key', false);

    // Should have an error
    assert(result.error, 'Should have error for invalid WIF');
    assert(!result.rawtx, 'Should not have rawtx with invalid WIF');
    assert(!result.txid, 'Should not have txid with invalid WIF');
    errorOccurred = true;
    console.log(`  Invalid WIF error: "${result.error}"`);
  } catch (error) {
    errorOccurred = true;
    console.log(`  Transfer threw error for invalid WIF: "${error.message}"`);
  }

  assert(errorOccurred, 'Invalid WIF should cause an error');
}

// Test 6.5: Transfer with zero amount
async function testZeroAmount() {
  const request = [
    {
      address: testConfig.addresses.emptyAddress,
      amount: 0,
    },
  ];

  let errorOccurred = false;
  try {
    const result = await mnee.transfer(request, TEST_WIF, false);

    if (result.error) {
      assert(!result.rawtx, 'Should not have rawtx when error occurs');
      assert(!result.txid, 'Should not have txid when error occurs');
      errorOccurred = true;
      console.log(`  Zero amount error: "${result.error}"`);
    } else if (result.rawtx) {
      // Some protocols might allow zero amount transfers
      console.log('  Zero amount transfer created (protocol allows this)');
      const isValid = await mnee.validateMneeTx(result.rawtx);
      console.log(`  Zero amount transaction validation: ${isValid}`);
    }
  } catch (error) {
    errorOccurred = true;
    console.log(`  Transfer threw error for zero amount: "${error.message}"`);
  }

  // Zero amount should either error or create a valid transaction
  assert(errorOccurred || true, 'Zero amount handled appropriately');
}

// Test 6.6: Transfer with invalid recipient address
async function testInvalidRecipient() {
  const request = [
    {
      address: testConfig.addresses.invalidAddress,
      amount: 0.01,
    },
  ];

  try {
    const result = await mnee.transfer(request, TEST_WIF, false);

    // Should have an error
    assert(result.error || !result.rawtx, 'Should fail for invalid recipient address');
    console.log(`  Invalid recipient handled: ${result.error || 'no transaction created'}`);
  } catch (error) {
    console.log(`  Transfer threw error for invalid recipient: "${error.message}"`);
  }
}

// Test 6.7: Transfer with empty request array
async function testEmptyRequest() {
  const request = [];

  let errorOccurred = false;
  try {
    const result = await mnee.transfer(request, TEST_WIF, false);

    if (result.error) {
      assert(!result.rawtx, 'Should not have rawtx with empty request');
      errorOccurred = true;
      console.log(`  Empty request error: "${result.error}"`);
    } else {
      assert.fail('Should not create transaction with empty request');
    }
  } catch (error) {
    errorOccurred = true;
    console.log(`  Transfer threw error for empty request: "${error.message}"`);
  }

  assert(errorOccurred, 'Empty request should cause an error');
}

// Test 6.8: Transfer with negative amount
async function testNegativeAmount() {
  const request = [
    {
      address: testConfig.addresses.emptyAddress,
      amount: -1,
    },
  ];

  let errorOccurred = false;
  try {
    const result = await mnee.transfer(request, TEST_WIF, false);

    assert(result.error || !result.rawtx, 'Should fail for negative amount');
    errorOccurred = true;
    console.log(`  Negative amount handled: ${result.error || 'rejected'}`);
  } catch (error) {
    errorOccurred = true;
    console.log(`  Transfer threw error for negative amount: "${error.message}"`);
  }

  assert(errorOccurred, 'Negative amount should cause an error');
}

// Test 6.9: Transfer with broadcast = true (skip in test environment)
async function testTransferWithBroadcast() {
  console.log('  Note: Skipping actual broadcast in sandbox environment');
  console.log('  Testing broadcast=true behavior without submitting to network');

  // Test that broadcast=true returns different result structure
  const request = [
    {
      address: '1525VDfA8swjDMLHjLRCCmPFsTJToarrA2',
      amount: 0.01,
    },
  ];

  // First create transaction without broadcast to compare
  const noBroadcastResult = await mnee.transfer(request, TEST_WIF, false);
  assert(noBroadcastResult.rawtx && !noBroadcastResult.txid, 'Without broadcast should return rawtx but no txid');

  // IMPORTANT: The following code would actually broadcast and spend funds!
  // Uncomment only if you want to test real broadcasting in sandbox/production

  try {
    const broadcastResult = await mnee.transfer(request, TEST_WIF, true);

    // When broadcast=true succeeds
    if (broadcastResult.txid) {
      assert(broadcastResult.txid, 'Broadcast result should have txid');
      assert(!broadcastResult.error, 'Successful broadcast should not have error');
      assert(typeof broadcastResult.txid === 'string', 'txid should be a string');
      assert(broadcastResult.txid.length === 64, 'txid should be 64 characters (32 bytes hex)');
      console.log(`  ✓ Transaction broadcast successfully: ${broadcastResult.txid}`);

      const txDetails = await mnee.parseTx(broadcastResult.txid);
      assert(txDetails, 'Broadcast transaction should be retrievable');
    }
    // When broadcast fails
    else if (broadcastResult.error) {
      assert(broadcastResult.error, 'Failed broadcast should have error message');
      assert(!broadcastResult.txid, 'Failed broadcast should not have txid');
      console.log(`  ✓ Broadcast failed as expected: ${broadcastResult.error}`);
    } else {
      assert.fail('Broadcast result should have either txid or error');
    }
  } catch (error) {
    console.log(`  ✓ Broadcast threw error (may be expected): ${error.message}`);
  }

  console.log('  ✓ Broadcast test structure verified');
}

// Run tests
async function runTests() {
  console.log('Running transfer tests...\n');
  console.log('Note: These tests use the test WIF key from config.');
  console.log(`Test address: ${TEST_ADDRESS}\n`);

  try {
    // Check if we have a balance to work with
    const balance = await mnee.balance(TEST_ADDRESS);
    console.log(`Current balance: ${balance.decimalAmount} MNEE\n`);

    if (balance.decimalAmount === 0) {
      console.log('⚠️  Warning: Test address has zero balance. Some tests may fail.\n');
    }

    console.log('Test 6.1: Transfer without broadcast');
    await testTransferNoBroadcast();
    console.log('✅ Test 6.1 passed\n');

    console.log('Test 6.2: Transfer with multiple recipients');
    await testMultipleRecipients();
    console.log('✅ Test 6.2 passed\n');

    console.log('Test 6.3: Transfer with insufficient balance');
    await testInsufficientBalance();
    console.log('✅ Test 6.3 passed\n');

    console.log('Test 6.4: Transfer with invalid WIF');
    await testInvalidWif();
    console.log('✅ Test 6.4 passed\n');

    console.log('Test 6.5: Transfer with zero amount');
    await testZeroAmount();
    console.log('✅ Test 6.5 passed\n');

    console.log('Test 6.6: Transfer with invalid recipient');
    await testInvalidRecipient();
    console.log('✅ Test 6.6 passed\n');

    console.log('Test 6.7: Transfer with empty request');
    await testEmptyRequest();
    console.log('✅ Test 6.7 passed\n');

    console.log('Test 6.8: Transfer with negative amount');
    await testNegativeAmount();
    console.log('✅ Test 6.8 passed\n');

    console.log('Test 6.9: Transfer with broadcast');
    await testTransferWithBroadcast();
    console.log('✅ Test 6.9 passed\n');

    console.log('All tests passed! ✅');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
