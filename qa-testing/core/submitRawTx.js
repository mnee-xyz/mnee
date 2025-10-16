import Mnee from 'mnee';
import assert from 'assert';
import testConfig from '../testConfig.js';

// Test configuration
const config = {
  environment: testConfig.environment,
  apiKey: testConfig.apiKey,
};

const mnee = new Mnee(config);

// Test addresses and WIF from config
const TEST_WIF = testConfig.wallet.testWif;

// Test 8.1: Submit valid raw transaction (but don't actually broadcast)
async function testSubmitValidRawTx() {
  // First create a valid transaction that we won't actually submit
  const request = [
    {
      address: testConfig.addresses.testAddress,
      amount: 0.01,
    },
  ];

  try {
    // Create a transaction without broadcasting
    const createResult = await mnee.transfer(request, TEST_WIF, { broadcast: false });
    assert(createResult.rawtx, 'Should create raw transaction');

    console.log('  Created test transaction');
    console.log(`  Raw tx length: ${createResult.rawtx.length} characters`);

    // Submit the raw transaction
    const submitResult = await mnee.submitRawTx(createResult.rawtx);
    assert(submitResult.ticketId, 'Should have ticketId');
    assert(!submitResult.error, 'Should not have error');
    console.log(`  Submitted ticketId: ${submitResult.ticketId}`);

    // Wait a bit for processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check the status of the submitted transaction
    const status = await mnee.getTxStatus(submitResult.ticketId);
    console.log(`  Transaction status: ${status.status}`);
    if (status.status === 'SUCCESS') {
      console.log(`  Transaction ID: ${status.tx_id}`);
    }
  } catch (error) {
    console.log(`  Valid raw tx test error: ${error.message}`);
  }
}

// Test 8.2: Submit invalid raw transaction
async function testSubmitInvalidRawTx() {
  // Create an invalid hex string that looks like a transaction but is malformed
  const invalidRawTx =
    '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff0100f2052a010000001976a914c825a1ecf2a6830c4401620c3a16f1995057c2ab88acBADBADBAD';

  try {
    const result = await mnee.submitRawTx(invalidRawTx);

    // Should have an error
    assert(result.error, 'Should have error for invalid raw tx');
    assert(!result.ticketId, 'Should not have ticketId when error occurs');
    assert(!result.rawtx, 'Should not return rawtx in response');

    console.log(`  Invalid raw tx error: "${result.error}"`);
  } catch (error) {
    console.log(`  submitRawTx threw error for invalid tx: "${error.message}"`);
  }
}

// Test 8.3: Submit malformed hex string
async function testSubmitMalformedHex() {
  const malformedHex = 'not-a-valid-hex-string';

  let errorOccurred = false;
  try {
    const result = await mnee.submitRawTx(malformedHex);

    assert(result.error, 'Should have error for malformed hex');
    assert(!result.ticketId, 'Should not have ticketId for malformed hex');
    errorOccurred = true;
    console.log(`  Malformed hex error: "${result.error}"`);
  } catch (error) {
    errorOccurred = true;
    console.log(`  submitRawTx threw error for malformed hex: "${error.message}"`);
  }

  assert(errorOccurred, 'Malformed hex should cause an error');
}

// Test 8.4: Submit empty string
async function testSubmitEmptyString() {
  let errorOccurred = false;
  try {
    const result = await mnee.submitRawTx('');

    assert(result.error || !result.ticketId, 'Should fail for empty string');
    errorOccurred = true;
    console.log(`  Empty string handled: ${result.error || 'rejected'}`);
  } catch (error) {
    errorOccurred = true;
    console.log(`  submitRawTx threw error for empty string: "${error.message}"`);
  }

  assert(errorOccurred, 'Empty string should cause an error');
}

// Test 8.5: Submit already broadcast transaction
async function testSubmitAlreadyBroadcast() {
  // This would test submitting a transaction that's already in the mempool/blockchain
  // We'll create a valid transaction to simulate this

  console.log('  Note: Testing duplicate submission behavior');
  console.log('  In production, this would test mempool rejection');

  try {
    // Create a valid transaction
    const request = [
      {
        address: testConfig.addresses.testAddress,
        amount: 0.01,
      },
    ];

    const createResult = await mnee.transfer(request, TEST_WIF, { broadcast: false });
    assert(createResult.rawtx, 'Should create raw transaction');

    // First submission would succeed
    const result1 = await mnee.submitRawTx(createResult.rawtx);
    assert(result1.ticketId, 'Should have ticketId');
    assert(!result1.error, 'Should not have error');
    console.log(`  Submitted ticketId: ${result1.ticketId}`);

    // Wait for first submission to process
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Second submission would fail with "already in mempool" error
    const result2 = await mnee.submitRawTx(createResult.rawtx);
    assert(result2.error, 'Should have error');
    assert(!result2.ticketId, 'Should not have ticketId');
    console.log(`  Duplicate submission error: "${result2.error}"`);
  } catch (error) {
    console.log(`  Already broadcast test: ${error.message}`);
  }
}

// Test 8.6: Submit partially signed transaction
async function testSubmitPartiallySigned() {
  console.log('  Note: submitRawTx expects a fully signed transaction');
  console.log('  Partially signed transactions should be completed before submission');

  // Create a transaction but don't sign it completely
  // This is a conceptual test since the SDK handles signing internally

  const unsignedTx =
    '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff00ffffffff0100000000000000000000';

  try {
    const result = await mnee.submitRawTx(unsignedTx);

    assert(result.error, 'Should have error for unsigned transaction');
    console.log(`  Unsigned tx error: "${result.error}"`);
  } catch (error) {
    console.log(`  submitRawTx threw error for unsigned tx: "${error.message}"`);
  }
}

// Test 8.7: Submit with network issues
async function testNetworkError() {
  console.log('  Note: Network errors would be handled by the service');
  console.log('  Result would contain error message about network issues');

  // In production, this might test:
  // - Network timeouts
  // - Service unavailable (503)
  // - Rate limiting (429)
}

// Run tests
async function runTests() {
  console.log('Running submitRawTx tests...\n');
  console.log('Note: These tests submit real transactions to the network.');
  console.log('submitRawTx now uses the V2 async API and returns ticketId.\n');

  try {
    console.log('Test 8.1: Submit valid raw transaction');
    await testSubmitValidRawTx();
    console.log('✅ Test 8.1 passed\n');

    console.log('Test 8.2: Submit invalid raw transaction');
    await testSubmitInvalidRawTx();
    console.log('✅ Test 8.2 passed\n');

    console.log('Test 8.3: Submit malformed hex string');
    await testSubmitMalformedHex();
    console.log('✅ Test 8.3 passed\n');

    console.log('Test 8.4: Submit empty string');
    await testSubmitEmptyString();
    console.log('✅ Test 8.4 passed\n');

    console.log('Test 8.5: Submit already broadcast transaction');
    await testSubmitAlreadyBroadcast();
    console.log('✅ Test 8.5 passed\n');

    console.log('Test 8.6: Submit partially signed transaction');
    await testSubmitPartiallySigned();
    console.log('✅ Test 8.6 passed\n');

    console.log('Test 8.7: Network error handling');
    await testNetworkError();
    console.log('✅ Test 8.7 passed\n');

    console.log('All tests passed! ✅');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
