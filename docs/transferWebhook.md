# Transfer Webhooks

The MNEE SDK supports webhook callbacks for asynchronous transaction status updates. When you provide a `callbackUrl` in your transfer options, the MNEE API will send real-time status updates to your webhook endpoint as the transaction progresses through various states.

## How It Works

When you initiate a transfer with a webhook URL, the API will:
1. Accept your transaction and return a `ticketId` immediately
2. Process the transaction asynchronously
3. Send POST requests to your webhook URL as the transaction status changes
4. Continue sending updates until the transaction reaches a final state (SUCCESS, MINED, or FAILED)

## Webhook Response Format

Your webhook endpoint will receive a POST request with the following `TransferWebhookResponse` payload:

```typescript
{
  id: string;              // The ticket ID for this transaction
  tx_id: string;           // The blockchain transaction ID
  tx_hex: string;          // The raw transaction hex
  action_requested: 'transfer';  // Always 'transfer' for MNEE transactions
  callback_url: string;    // Your webhook URL (for verification)
  status: 'BROADCASTING' | 'SUCCESS' | 'MINED' | 'FAILED';
  createdAt: string;       // ISO timestamp when ticket was created
  updatedAt: string;       // ISO timestamp of this update
  errors: string | null;   // Error details if status is FAILED
}
```

## Status Flow

Transactions typically progress through these states:
- **BROADCASTING** → Transaction is being broadcast to the network
- **SUCCESS** → Transaction successfully broadcast and accepted by the network
- **MINED** → Transaction has been mined into a block
- **FAILED** → Transaction failed (check `errors` field for details)

## Usage Examples

### Basic Transfer with Webhook

```typescript
const recipients = [
  { address: 'recipient-address', amount: 10.5 }
];

const response = await mnee.transfer(recipients, wif, {
  broadcast: true,
  callbackUrl: 'https://your-api.com/webhook'
});

console.log('Transaction submitted:', response.ticketId);
// Your webhook will receive status updates asynchronously
```

### Transfer Multi with Webhook

```typescript
const options = {
  inputs: [
    { txid: 'abc...', vout: 0, wif: 'wif1' },
    { txid: 'def...', vout: 1, wif: 'wif2' }
  ],
  recipients: [
    { address: 'address1', amount: 5.0 },
    { address: 'address2', amount: 3.5 }
  ]
};

const response = await mnee.transferMulti(options, {
  broadcast: true,
  callbackUrl: 'https://your-api.com/webhook'
});

console.log('Multi-transfer submitted:', response.ticketId);
```

### Submit Raw Transaction with Webhook

```typescript
const rawTxHex = '0100000001...'; // Your signed transaction

const response = await mnee.submitRawTx(rawTxHex, {
  broadcast: true,
  callbackUrl: 'https://your-api.com/webhook'
});

console.log('Raw transaction submitted:', response.ticketId);
```

## Implementing a Webhook Endpoint

### Express.js Example

```typescript
import express from 'express';

const app = express();
app.use(express.json());

app.post('/webhook', async (req, res) => {
  const webhookData = req.body;
  
  console.log(`Transaction ${webhookData.id} status: ${webhookData.status}`);
  
  switch (webhookData.status) {
    case 'BROADCASTING':
      // Transaction is being broadcast
      await updateDatabase(webhookData.id, 'broadcasting');
      break;
      
    case 'SUCCESS':
      // Transaction successfully broadcast
      await updateDatabase(webhookData.id, 'success', webhookData.tx_id);
      await notifyUser(webhookData.id, 'Your transaction has been broadcast!');
      break;
      
    case 'MINED':
      // Transaction mined into a block
      await updateDatabase(webhookData.id, 'confirmed', webhookData.tx_id);
      await notifyUser(webhookData.id, 'Your transaction has been confirmed!');
      break;
      
    case 'FAILED':
      // Transaction failed
      await updateDatabase(webhookData.id, 'failed', null, webhookData.errors);
      await notifyUser(webhookData.id, `Transaction failed: ${webhookData.errors}`);
      break;
  }
  
  // Always respond with 200 to acknowledge receipt
  res.status(200).json({ received: true });
});

app.listen(3000, () => {
  console.log('Webhook server listening on port 3000');
});
```

## Best Practices

### 1. Always Return 200 OK

Always return a 200 status code to acknowledge receipt, even if processing fails. This prevents the webhook from being retried unnecessarily.

```typescript
app.post('/webhook', async (req, res) => {
  try {
    await processWebhook(req.body);
  } catch (error) {
    // Log error but still return 200
    console.error('Webhook processing failed:', error);
  }
  
  res.status(200).json({ received: true });
});
```

### 2. Implement Idempotency

Webhooks may be sent multiple times for the same status. Design your handler to be idempotent:

```typescript
async function processWebhook(data) {
  // Check if we've already processed this update
  const processed = await checkIfProcessed(data.id, data.status, data.updatedAt);
  if (processed) {
    console.log(`Already processed ${data.id} at status ${data.status}`);
    return;
  }
  
  // Process the update
  await updateTransactionStatus(data);
  
  // Mark as processed
  await markAsProcessed(data.id, data.status, data.updatedAt);
}
```

### 3. Handle Timeouts Gracefully

Set up fallback polling for critical transactions in case webhooks fail:

```typescript
async function transferWithFallback(recipients, wif, webhookUrl) {
  const response = await mnee.transfer(recipients, wif, {
    broadcast: true,
    callbackUrl: webhookUrl
  });
  
  // Set up fallback polling after 30 seconds
  setTimeout(async () => {
    const status = await mnee.getTxStatus(response.ticketId);
    if (status.status === 'BROADCASTING') {
      // Webhook might have failed, start polling
      pollTransactionStatus(response.ticketId);
    }
  }, 30000);
  
  return response;
}
```

### 4. Secure Your Endpoint

Implement security measures to protect your webhook endpoint:

```typescript
// Use a secret path
app.post('/webhook/' + process.env.WEBHOOK_SECRET, handler);

// Implement rate limiting
import rateLimit from 'express-rate-limit';
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100 // limit to 100 requests per minute
});
app.use('/webhook', limiter);

// Validate payload structure
function validateWebhookPayload(data) {
  return (
    typeof data.id === 'string' &&
    typeof data.tx_id === 'string' &&
    typeof data.status === 'string' &&
    ['BROADCASTING', 'SUCCESS', 'MINED', 'FAILED'].includes(data.status)
  );
}
```

### 5. Queue for Processing

For high-volume applications, queue webhook payloads for async processing:

```typescript
import Queue from 'bull';
const webhookQueue = new Queue('webhook-processing');

app.post('/webhook', async (req, res) => {
  // Immediately queue for processing
  await webhookQueue.add('process-webhook', req.body);
  
  // Return immediately
  res.status(200).json({ received: true });
});

// Process queue items
webhookQueue.process('process-webhook', async (job) => {
  const webhookData = job.data;
  await processWebhook(webhookData);
});
```

## Testing Webhooks

### Local Development with ngrok

For local testing, use ngrok to expose your local server:

```bash
# Install ngrok
npm install -g ngrok

# Start your local server on port 3000
npm run dev

# In another terminal, expose port 3000
ngrok http 3000

# Use the ngrok URL as your webhook
# https://abc123.ngrok.io/webhook
```

### Test Webhook Server

Create a simple test server to log webhook calls:

```typescript
// test-webhook-server.js
const express = require('express');
const app = express();

app.use(express.json());
app.use(express.text());

// Log all webhooks
app.all('*', (req, res) => {
  console.log('=== Webhook Received ===');
  console.log('Method:', req.method);
  console.log('Path:', req.path);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  console.log('========================');
  
  res.status(200).json({ received: true });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Test webhook server listening on port ${port}`);
});
```

## Error Handling

### Webhook Delivery Failures

If webhook delivery fails, you can still check transaction status using the ticket ID:

```typescript
async function checkTransactionWithFallback(ticketId) {
  try {
    // Check if we received webhook updates
    const webhookStatus = await getWebhookStatus(ticketId);
    if (webhookStatus) {
      return webhookStatus;
    }
    
    // Fall back to polling
    console.log('No webhook received, polling status...');
    const status = await mnee.getTxStatus(ticketId);
    return status;
  } catch (error) {
    console.error('Failed to check transaction status:', error);
    throw error;
  }
}
```

### Handling Failed Transactions

When a webhook indicates a failed transaction:

```typescript
async function handleFailedTransaction(webhookData) {
  // Log the failure
  console.error(`Transaction ${webhookData.id} failed:`, webhookData.errors);
  
  // Parse error for specific handling
  if (webhookData.errors?.includes('Insufficient')) {
    // Handle insufficient funds
    await notifyUserInsufficientFunds(webhookData.id);
  } else if (webhookData.errors?.includes('Invalid')) {
    // Handle invalid transaction
    await notifyUserInvalidTransaction(webhookData.id);
  } else {
    // Generic error handling
    await notifyUserTransactionFailed(webhookData.id, webhookData.errors);
  }
  
  // Maybe retry with different parameters
  if (shouldRetry(webhookData.errors)) {
    await retryTransaction(webhookData.id);
  }
}
```

## Important Notes

- Webhooks are only sent when `broadcast: true` and a `callbackUrl` is provided
- The webhook URL must be publicly accessible (not localhost unless using ngrok or similar)
- Webhooks may arrive out of order - always check the `updatedAt` timestamp
- Multiple webhooks may be sent for the same status - implement idempotency
- Webhook delivery is not guaranteed - implement fallback polling for critical transactions
- The `tx_id` field will be empty until the transaction reaches SUCCESS status
- Always respond quickly to webhooks (< 5 seconds) to avoid timeouts

## See Also

- [Transfer](./transfer.md) - Create and broadcast transactions
- [Transfer Multi](./transferMulti.md) - Advanced transfers with multiple inputs
- [Submit Raw Transaction](./submitRawTx.md) - Submit pre-signed transactions
- [Get Transaction Status](./getTxStatus.md) - Poll for transaction status