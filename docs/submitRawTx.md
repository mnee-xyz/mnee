# Submit Raw Transaction

The `submitRawTx` method submits a pre-signed raw transaction to the MNEE network for asynchronous processing. This is useful when you have a transaction that was created offline, received from another service, or created with `broadcast: false` and need to broadcast it later.

## Usage

```typescript
const rawTxHex = '0100000001...'; // Your signed raw transaction hex
const result = await mnee.submitRawTx(rawTxHex);
console.log('Ticket ID:', result.ticketId);

// Check transaction status
const status = await mnee.getTxStatus(result.ticketId);
console.log('Transaction ID:', status.tx_id);
```

### With Webhook Callback

```typescript
const rawTxHex = '0100000001...'; // Your signed raw transaction hex

// Submit with webhook for async status updates
const result = await mnee.submitRawTx(rawTxHex, {
  broadcast: true,
  callbackUrl: 'https://your-api.com/webhook',
});

console.log('Ticket ID:', result.ticketId);
// Your webhook will receive status updates as the transaction progresses
```

## Parameters

- **rawTxHex**: The complete, signed raw transaction in hexadecimal format
- **transferOptions** (optional): Object containing:
  - **broadcast**: Whether to broadcast the transaction (default: `true`)
  - **callbackUrl**: Webhook URL for status updates (only when broadcast is true)

## Response

Returns a `TransferResponse` object:

```typescript
{
  ticketId?: string;  // Ticket ID for tracking (only if broadcast is true)
  rawtx?: string;     // The raw transaction hex (only if broadcast is false)
}
```

## Common Use Cases

### Delayed Broadcasting

```typescript
async function createAndHoldTransaction(recipients, wif) {
  // Create transaction without broadcasting
  const created = await mnee.transfer(recipients, wif, { broadcast: false });

  // Store for later (database, file, etc.)
  await saveTransaction(created.rawtx);

  // Later, when ready to broadcast
  const savedTx = await loadTransaction();
  const result = await mnee.submitRawTx(savedTx);

  console.log('Transaction ticket:', result.ticketId);

  // Wait for confirmation
  let status;
  do {
    status = await mnee.getTxStatus(result.ticketId);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  } while (status.status === 'BROADCASTING');

  if (status.status === 'SUCCESS' || status.status === 'MINED') {
    return status.tx_id;
  } else {
    throw new Error('Transaction failed');
  }
}
```

### Transaction Queue System

```typescript
class TransactionQueue {
  constructor(mnee) {
    this.mnee = mnee;
    this.queue = [];
  }

  async addTransaction(rawTx) {
    this.queue.push({
      rawTx,
      added: new Date(),
      status: 'pending',
    });
  }

  async processQueue() {
    for (const tx of this.queue) {
      if (tx.status === 'pending') {
        try {
          const result = await this.mnee.submitRawTx(tx.rawTx);
          tx.status = 'submitted';
          tx.ticketId = result.ticketId;
          tx.submitTime = new Date();

          console.log(`Submitted: ${result.ticketId}`);

          // Check status asynchronously
          this.checkStatus(tx.ticketId).then((status) => {
            if (status.status === 'SUCCESS' || status.status === 'MINED') {
              tx.status = 'confirmed';
              tx.txid = status.tx_id;
            } else if (status.status === 'FAILED') {
              tx.status = 'failed';
              tx.error = status.errors;
            }
          });
        } catch (error) {
          tx.status = 'failed';
          tx.error = error.message;
          console.error(`Failed: ${error.message}`);
        }
      }
    }
  }

  async checkStatus(ticketId) {
    return await this.mnee.getTxStatus(ticketId);
  }
}
```

### Multi-Stage Approval Process

```typescript
async function multiStageTransfer(recipients, wif) {
  // Stage 1: Create
  const created = await mnee.transfer(recipients, wif, { broadcast: false });

  // Stage 2: Validate
  const isValid = await mnee.validateMneeTx(created.rawtx, recipients);
  if (!isValid) {
    throw new Error('Transaction validation failed');
  }

  // Stage 3: Review
  const parsed = await mnee.parseTxFromRawTx(created.rawtx);
  const approved = await getApproval(parsed);

  if (!approved) {
    throw new Error('Transaction not approved');
  }

  // Stage 4: Submit
  const result = await mnee.submitRawTx(created.rawtx);

  // Stage 5: Confirm
  let status;
  do {
    status = await mnee.getTxStatus(result.ticketId);
    if (status.status === 'FAILED') {
      throw new Error('Transaction failed: ' + status.errors);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  } while (status.status === 'BROADCASTING');

  return status.tx_id;
}
```

### Retry Failed Broadcasts

```typescript
async function submitWithRetry(rawTxHex, maxRetries = 3) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await mnee.submitRawTx(rawTxHex);
      console.log(`Success on attempt ${i + 1}: ${result.ticketId}`);

      // Wait for confirmation
      let status;
      let attempts = 0;
      while (attempts < 30) {
        status = await mnee.getTxStatus(result.ticketId);

        if (status.status === 'SUCCESS' || status.status === 'MINED') {
          return status.tx_id;
        }

        if (status.status === 'FAILED') {
          throw new Error('Transaction failed: ' + status.errors);
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
        attempts++;
      }

      throw new Error('Transaction timeout after 60 seconds');
    } catch (error) {
      lastError = error;
      console.log(`Attempt ${i + 1} failed: ${error.message}`);

      // Wait before retry (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }

  throw new Error(`Failed after ${maxRetries} attempts: ${lastError.message}`);
}
```

### External Wallet Integration

```typescript
async function integrateExternalWallet(externalWalletAPI) {
  // Get signed transaction from external wallet
  const signedTx = await externalWalletAPI.createMNEETransfer({
    to: 'recipient-address',
    amount: 10,
  });

  // Validate before submitting
  const isValid = await mnee.validateMneeTx(signedTx);
  if (!isValid) {
    throw new Error('External wallet created invalid transaction');
  }

  // Submit to network with webhook
  const result = await mnee.submitRawTx(signedTx, {
    callbackUrl: 'https://your-api.com/webhook',
  });

  // Wait for confirmation
  let status;
  do {
    status = await mnee.getTxStatus(result.ticketId);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  } while (status.status === 'BROADCASTING');

  if (status.status === 'FAILED') {
    throw new Error('Transaction failed: ' + status.errors);
  }

  // Notify external wallet of success
  await externalWalletAPI.confirmBroadcast(status.tx_id);

  return status.tx_id;
}
```

## Error Handling

The submitRawTx method can throw several specific errors:

```typescript
try {
  const result = await mnee.submitRawTx(rawTxHex);
  console.log('Success:', result.ticketId);
} catch (error) {
  switch (error.message) {
    case 'Raw transaction is required':
      console.error('No transaction hex provided');
      break;
    case 'Callback URL cannot be provided when broadcast is false':
      console.error('Cannot use webhook without broadcasting');
      break;
    case 'Failed to submit transaction':
      console.error('Submission to network failed');
      break;
    case 'Invalid API key':
      console.error('API key authentication failed (401/403)');
      break;
    default:
      if (error.message.includes('HTTP error! status:')) {
        console.error('API request failed:', error.message);
      } else {
        console.error('Submit failed:', error.message);
      }
  }
}
```

## Important Notes

- The transaction must be completely signed before submission
- The transaction must be valid according to MNEE protocol rules
- Once broadcast, transactions cannot be reversed
- If a transaction has already been broadcast, submitting again will fail
- Transactions are processed asynchronously - a ticketId is returned immediately for tracking
- Use `getTxStatus` to check if the transaction was successfully broadcast to the network
- Webhook callbacks provide real-time status updates without polling
- The transaction ID is only available after the status reaches SUCCESS

## See Also

- [Transfer](./transfer.md) - Create and broadcast transactions
- [Transfer Multi](./transferMulti.md) - Create complex transactions
- [Get Transaction Status](./getTxStatus.md) - Track transaction status
- [Transfer Webhooks](./transferWebhook.md) - Webhook callbacks for async updates
- [Validate Transaction](./validateMneeTx.md) - Validate before submitting
- [Parse Transaction](./parseTx.md) - Examine transaction details
