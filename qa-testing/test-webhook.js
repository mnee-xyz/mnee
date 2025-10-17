import Mnee from 'mnee';
import testConfig from './testConfig.js';

// Test configuration
const config = {
  environment: testConfig.environment,
  apiKey: testConfig.apiKey,
};

const mnee = new Mnee(config);
const TEST_WIF = testConfig.wallet.testWif;

async function testWebhookCallback() {
  console.log('\n📧 Testing submitRawTx with webhook callback\n');
  console.log('Make sure you have:');
  console.log('1. Started the webhook server: node webhook-server.js');
  console.log('2. Started ngrok: ngrok http 3000');
  console.log('3. Updated the WEBHOOK_URL below with your ngrok URL\n');

  // UPDATE THIS with your ngrok URL
  const WEBHOOK_URL = 'https://7b1229b78a7c.ngrok-free.app/webhook';

  if (WEBHOOK_URL.includes('YOUR-NGROK-ID')) {
    console.error('❌ Please update WEBHOOK_URL with your actual ngrok URL');
    console.log('\nExample: https://abc123.ngrok.io/webhook\n');
    process.exit(1);
  }

  try {
    // Create a small transaction
    const request = [
      {
        address: '1525VDfA8swjDMLHjLRCCmPFsTJToarrA2',
        amount: 0.01,
      },
    ];

    console.log('Creating transaction...');
    const createResult = await mnee.transfer(request, TEST_WIF, { broadcast: false });
    console.log('✅ Transaction created');
    console.log(`   Raw tx length: ${createResult.rawtx.length} characters\n`);

    console.log('Submitting transaction with webhook callback...');
    console.log(`   Webhook URL: ${WEBHOOK_URL}`);

    // Submit with callback URL
    const submitResult = await mnee.submitRawTx(createResult.rawtx, {
      callbackUrl: WEBHOOK_URL,
    });

    if (submitResult.ticketId) {
      console.log('✅ Transaction submitted successfully');
      console.log(`   Ticket ID: ${submitResult.ticketId}\n`);

      console.log('📊 Checking transaction status...');

      // Poll status for up to 30 seconds
      let attempts = 0;
      const maxAttempts = 15;

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const status = await mnee.getTxStatus(submitResult.ticketId);
        console.log(`   Attempt ${attempts + 1}: Status = ${status.status}`);

        if (status.status === 'SUCCESS') {
          console.log('\n✅ Transaction successful!');
          console.log(`   Transaction ID: ${status.tx_id}`);
          console.log('\n🔔 Check your webhook server console for callback data!');
          break;
        } else if (status.status === 'FAILED' || status.status === 'ERROR') {
          console.log(`\n❌ Transaction failed: ${status.status}`);
          if (status.message) {
            console.log(`   Error: ${status.message}`);
          }
          break;
        }

        attempts++;
      }

      if (attempts >= maxAttempts) {
        console.log('\n⏱️  Transaction still processing after 30 seconds');
        console.log('   Continue checking the webhook server for updates');
      }
    } else if (submitResult.error) {
      console.log('❌ Failed to submit transaction');
      console.log(`   Error: ${submitResult.error}`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Check balance first
async function checkAndRun() {
  try {
    const balance = await mnee.balance(testConfig.addresses.testAddress);
    console.log(`Current balance: ${balance.decimalAmount} MNEE`);

    if (balance.decimalAmount < 0.02) {
      console.log('\n⚠️  Insufficient balance for test (need at least 0.02 MNEE)');
      process.exit(1);
    }

    await testWebhookCallback();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkAndRun();
