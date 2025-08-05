# Submit Raw Transaction

The `submitRawTx` method submits a pre-signed raw transaction to the MNEE network. This is useful when you have a transaction that was created offline, received from another service, or created with `broadcast: false` and need to broadcast it later.

## Usage

```typescript
const rawTxHex = '0100000001...'; // Your signed raw transaction hex
const result = await mnee.submitRawTx(rawTxHex);
console.log('Transaction ID:', result.txid);
```

## Parameters

- **rawTxHex**: The complete, signed raw transaction in hexadecimal format

## Response

Returns a `TransferResponse` object:

```typescript
{
  rawtx: string;    // The raw transaction hex (same as input)
  txid?: string;    // The transaction ID if successfully broadcast
}
```

## Common Use Cases

### Delayed Broadcasting

```typescript
async function createAndHoldTransaction(recipients, wif) {
  // Create transaction without broadcasting
  const created = await mnee.transfer(recipients, wif, false);
  
  // Store for later (database, file, etc.)
  await saveTransaction(created.rawtx);
  
  // Later, when ready to broadcast
  const savedTx = await loadTransaction();
  const result = await mnee.submitRawTx(savedTx);
  
  console.log('Transaction broadcast:', result.txid);
  return result.txid;
}
```

### Offline Transaction Creation

```typescript
// On offline computer
async function createOfflineTransaction(recipients, wif) {
  // Create transaction offline
  const response = await mnee.transfer(recipients, wif, false);
  
  // Export to QR code, USB, etc.
  return response.rawtx;
}

// On online computer
async function broadcastOfflineTransaction(rawTxHex) {
  try {
    const result = await mnee.submitRawTx(rawTxHex);
    console.log('Offline transaction broadcast:', result.txid);
    return result.txid;
  } catch (error) {
    console.error('Broadcast failed:', error.message);
    throw error;
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
      status: 'pending'
    });
  }
  
  async processQueue() {
    for (const tx of this.queue) {
      if (tx.status === 'pending') {
        try {
          const result = await this.mnee.submitRawTx(tx.rawTx);
          tx.status = 'broadcast';
          tx.txid = result.txid;
          tx.broadcastTime = new Date();
          
          console.log(`Broadcast: ${result.txid}`);
        } catch (error) {
          tx.status = 'failed';
          tx.error = error.message;
          console.error(`Failed: ${error.message}`);
        }
      }
    }
  }
}
```

### Multi-Stage Approval Process

```typescript
async function multiStageTransfer(recipients, wif) {
  // Stage 1: Create
  const created = await mnee.transfer(recipients, wif, false);
  
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
  return result.txid;
}
```

### Retry Failed Broadcasts

```typescript
async function submitWithRetry(rawTxHex, maxRetries = 3) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await mnee.submitRawTx(rawTxHex);
      console.log(`Success on attempt ${i + 1}: ${result.txid}`);
      return result.txid;
    } catch (error) {
      lastError = error;
      console.log(`Attempt ${i + 1} failed: ${error.message}`);
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
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
    amount: 10
  });
  
  // Validate before submitting
  const isValid = await mnee.validateMneeTx(signedTx);
  if (!isValid) {
    throw new Error('External wallet created invalid transaction');
  }
  
  // Submit to network
  const result = await mnee.submitRawTx(signedTx);
  
  // Notify external wallet of success
  await externalWalletAPI.confirmBroadcast(result.txid);
  
  return result.txid;
}
```

## Error Handling

The submitRawTx method can throw several specific errors:

```typescript
try {
  const result = await mnee.submitRawTx(rawTxHex);
  console.log('Success:', result.txid);
} catch (error) {
  switch (error.message) {
    case 'Raw transaction is required':
      console.error('No transaction hex provided');
      break;
    case 'Failed to submit raw transaction':
      console.error('Cosigner rejected the transaction');
      break;
    case 'Failed to broadcast transaction':
      console.error('Broadcast to network failed');
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

Note: The cosigner API validates the transaction and may return additional errors in the response that get passed through as the error message.

## Important Notes

- The transaction must be completely signed before submission
- The transaction must be valid according to MNEE protocol rules
- Once broadcast, transactions cannot be reversed
- If a transaction has already been broadcast, submitting again will fail
- Network propagation typically takes a few seconds
- Always validate transactions before broadcasting to avoid losing fees

## See Also

- [Transfer](./transfer.md) - Create and broadcast transactions
- [Transfer Multi](./transferMulti.md) - Create complex transactions
- [Validate Transaction](./validateMneeTx.md) - Validate before submitting
- [Parse Transaction](./parseTx.md) - Examine transaction details