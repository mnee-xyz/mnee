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

// Helper function to wait
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Test getTxStatus with real broadcast
async function testGetTxStatus() {
  console.log('Creating a real transfer with broadcast=true...');

  // Create a small transfer to broadcast
  const request = [
    {
      address: '1525VDfA8swjDMLHjLRCCmPFsTJToarrA2', // Send to a different address
      amount: 0.01, // Small amount
    },
  ];

  try {
    // Step 1: Create and broadcast the transaction
    console.log('  Broadcasting transaction...');
    const transferResult = await mnee.transfer(request, TEST_WIF, { broadcast: true });

    // Should have a ticketId
    assert(transferResult.ticketId, 'Broadcast should return a ticketId');
    assert(!transferResult.error, 'Broadcast should not have error');
    assert(typeof transferResult.ticketId === 'string', 'ticketId should be a string');

    const ticketId = transferResult.ticketId;
    console.log(`  Transaction broadcast with ticketId: ${ticketId}`);

    // Step 2: Poll the status until we see SUCCESS or failure
    console.log('  Polling for transaction status...');

    let status;
    let attempts = 0;
    const maxAttempts = 30; // Poll for up to 60 seconds
    const pollInterval = 2000; // Poll every 2 seconds

    while (attempts < maxAttempts) {
      try {
        status = await mnee.getTxStatus(ticketId);
        console.log(`    Attempt ${attempts + 1}: Status = ${status.status}`);

        // Check the status field
        assert(status.status, 'Status response should have status field');

        if (status.status === 'SUCCESS') {
          console.log('  ✅ Transaction successful!');

          // Verify the response structure for SUCCESS
          assert(status.tx_id, 'SUCCESS status should have tx_id');
          assert(typeof status.tx_id === 'string', 'tx_id should be a string');
          assert(status.tx_id.length === 64, 'tx_id should be 64 characters');

          console.log(`  Transaction ID: ${status.tx_id}`);

          // Verify other expected fields
          assert(status.id, 'Should have ticket id');
          assert(status.tx_hex, 'Should have transaction hex');
          assert(status.action_requested === 'transfer', 'Action should be transfer');

          // Optional: Verify we can parse the transaction
          const txDetails = await mnee.parseTx(status.tx_id);
          assert(txDetails, 'Should be able to parse the broadcast transaction');
          assert(txDetails.txid === status.tx_id, 'Parsed txid should match');

          break;
        } else if (status.status === 'FAILED' || status.status === 'ERROR') {
          console.log(`  ❌ Transaction failed with status: ${status.status}`);
          if (status.message) {
            console.log(`  Error message: ${status.message}`);
          }
          assert.fail(`Transaction failed with status: ${status.status}`);
        } else if (status.status === 'PENDING' || status.status === 'PROCESSING') {
          // Continue polling
          await sleep(pollInterval);
        } else {
          console.log(`  Unknown status: ${status.status}`);
          // Continue polling for unknown statuses
          await sleep(pollInterval);
        }
      } catch (error) {
        console.log(`  Error polling status: ${error.message}`);
        throw error;
      }

      attempts++;
    }

    if (attempts >= maxAttempts) {
      assert.fail(`Transaction did not complete after ${(maxAttempts * pollInterval) / 1000} seconds`);
    }

    return status;
  } catch (error) {
    console.log(`  Test failed: ${error.message}`);
    throw error;
  }
}

// Test invalid ticketId
async function testInvalidTicketId() {
  console.log('Testing getTxStatus with invalid ticketId...');

  const invalidTicketIds = [
    { id: 'invalid-ticket-id', desc: 'Invalid format' },
    { id: '00000000-0000-0000-0000-000000000000', desc: 'All zeros UUID' },
    { id: '12345678-1234-1234-1234-123456789012', desc: 'Non-existent UUID' },
    { id: '', desc: 'Empty string' },
    { id: null, desc: 'Null value' },
    { id: undefined, desc: 'Undefined value' },
  ];

  for (const { id, desc } of invalidTicketIds) {
    try {
      const status = await mnee.getTxStatus(id);
      console.log(`  ${desc}: Status = ${status?.status || 'no status'}, Message = ${status?.message || 'no message'}`);
    } catch (error) {
      console.log(`  ${desc}: Error - ${error.message}`);
    }
  }
}

// Run tests
async function runTests() {
  console.log('Running getTxStatus tests...\n');
  console.log('Note: This test broadcasts a real transaction and costs MNEE tokens!');
  console.log(`Test address: ${TEST_ADDRESS}\n`);

  try {
    // Check if we have a balance to work with
    const balance = await mnee.balance(TEST_ADDRESS);
    console.log(`Current balance: ${balance.decimalAmount} MNEE\n`);

    if (balance.decimalAmount < 0.02) {
      console.log('⚠️  Warning: Insufficient balance for broadcast test (need at least 0.02 MNEE).\n');
      console.log('Skipping broadcast test...\n');
    } else {
      console.log('Test 1: Get transaction status with real broadcast');
      const status = await testGetTxStatus();
      console.log('✅ Test 1 passed\n');

      // Show final status details
      if (status) {
        console.log('Final transaction details:');
        console.log(`  Status: ${status.status}`);
        console.log(`  Transaction ID: ${status.tx_id}`);
        console.log(`  Ticket ID: ${status.id}`);
        if (status.message) {
          console.log(`  Message: ${status.message}`);
        }
        console.log('');
      }
    }

    console.log('Test 2: Get status with invalid ticket IDs');
    await testInvalidTicketId();
    console.log('✅ Test 2 passed\n');

    console.log('All tests passed! ✅');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
