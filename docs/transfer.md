# Transfer MNEE

The `transfer` method creates and optionally broadcasts MNEE token transfers. It handles all the complexity of creating valid MNEE transactions, including UTXO selection, fee calculation, and cosigner authorization.

## Usage

### Basic Transfer

```typescript
const recipients = [
  { address: 'recipient-address', amount: 2.55 }
];
const wif = 'sender-wif-key';

const response = await mnee.transfer(recipients, wif);
console.log('Transfer Response:', response);
```

### Multiple Recipients

```typescript
const recipients = [
  { address: 'recipient-1-address', amount: 2.55 },
  { address: 'recipient-2-address', amount: 5 },
  { address: 'recipient-3-address', amount: 0.75 }
];
const wif = 'sender-wif-key';

const response = await mnee.transfer(recipients, wif);
console.log('Transaction ID:', response.txid);
```

### Create Without Broadcasting

```typescript
const recipients = [
  { address: 'recipient-address', amount: 10 }
];

// Set broadcast to false to create but not submit
const response = await mnee.transfer(recipients, wif, false);
console.log('Raw transaction:', response.rawtx);
// Transaction ID will not be available until broadcast
```

## Parameters

- **request**: Array of `SendMNEE` objects, each containing:
  - **address**: Recipient Bitcoin address
  - **amount**: Amount to send in MNEE (not atomic units)
- **wif**: Wallet Import Format private key of the sender
- **broadcast** (optional): Whether to broadcast the transaction (default: `true`)

## Response

Returns a `TransferResponse` object:

```typescript
{
  rawtx: string;    // The raw transaction hex
  txid?: string;    // Transaction ID (only if broadcast is true)
}
```

## Common Use Cases

### Simple Payment

```typescript
async function payInvoice(recipientAddress, amountMNEE, senderWif) {
  try {
    const response = await mnee.transfer(
      [{ address: recipientAddress, amount: amountMNEE }],
      senderWif
    );
    console.log(`Payment sent! TxID: ${response.txid}`);
    return response.txid;
  } catch (error) {
    console.error('Payment failed:', error.message);
    throw error;
  }
}
```

### Batch Payments

```typescript
async function distributePayments(payments, senderWif) {
  // payments is array of {address, amount}
  try {
    const response = await mnee.transfer(payments, senderWif);
    console.log(`Distributed to ${payments.length} recipients`);
    console.log(`Transaction: ${response.txid}`);
    
    // Log each payment
    payments.forEach(p => {
      console.log(`  - ${p.address}: ${p.amount} MNEE`);
    });
    
    return response.txid;
  } catch (error) {
    console.error('Distribution failed:', error.message);
    throw error;
  }
}
```

### Two-Step Transfer with Validation

```typescript
async function secureTransfer(recipients, wif) {
  // Step 1: Create transaction without broadcasting
  const txResponse = await mnee.transfer(recipients, wif, false);
  
  // Step 2: Validate the transaction
  const isValid = await mnee.validateMneeTx(txResponse.rawtx, recipients);
  if (!isValid) {
    throw new Error('Transaction validation failed');
  }
  
  // Step 3: Parse to review
  const parsed = await mnee.parseTxFromRawTx(txResponse.rawtx);
  console.log('Transaction details:', parsed);
  
  // Step 4: Broadcast if everything looks good
  const submitResponse = await mnee.submitRawTx(txResponse.rawtx);
  return submitResponse.txid;
}
```

### Transfer with Balance Check

```typescript
async function safeTransfer(recipients, wif, senderAddress) {
  // Calculate total needed
  const totalNeeded = recipients.reduce((sum, r) => sum + r.amount, 0);
  
  // Check balance
  const balance = await mnee.balance(senderAddress);
  if (balance.decimalAmount < totalNeeded) {
    throw new Error(
      `Insufficient balance. Have ${balance.decimalAmount}, need ${totalNeeded} MNEE`
    );
  }
  
  // Proceed with transfer
  const response = await mnee.transfer(recipients, wif);
  console.log(`Transfer complete: ${response.txid}`);
  return response.txid;
}
```

### Micro-Payment Channel

```typescript
async function sendMicroPayment(address, amount, wif) {
  const MIN_AMOUNT = 0.001; // 0.001 MNEE minimum
  
  if (amount < MIN_AMOUNT) {
    throw new Error(`Amount too small. Minimum is ${MIN_AMOUNT} MNEE`);
  }
  
  const response = await mnee.transfer(
    [{ address, amount }],
    wif
  );
  
  return {
    txid: response.txid,
    amount: amount,
    timestamp: new Date().toISOString()
  };
}
```

## Error Handling

The transfer method can throw several specific errors:

```typescript
try {
  const response = await mnee.transfer(recipients, wif);
} catch (error) {
  switch (error.message) {
    case 'Config not fetched':
      console.error('Failed to fetch cosigner configuration');
      break;
    case 'Invalid transfer options':
      console.error('Invalid recipients or amounts');
      break;
    case 'Private key not found':
      console.error('Invalid WIF private key');
      break;
    case 'Invalid amount':
      console.error('Amount must be greater than 0');
      break;
    case 'Insufficient MNEE balance':
      console.error('Not enough MNEE tokens');
      break;
    case 'Failed to broadcast transaction':
      console.error('Cosigner rejected the transaction');
      break;
    case 'Invalid API key':
      console.error('API key authentication failed (401/403)');
      break;
    default:
      if (error.message.includes('HTTP error! status:')) {
        console.error('API request failed:', error.message);
      } else {
        console.error('Transfer failed:', error.message);
      }
  }
}
```

## Important Notes

- Amounts are specified in MNEE, not atomic units (1 MNEE = 100,000 atomic units)
- The method automatically:
  - Selects appropriate UTXOs
  - Calculates fees based on transaction size
  - Adds change output if needed
  - Obtains cosigner authorization
- Minimum transfer amount is determined by dust limit (check via `config()`)
- All recipients must have valid Bitcoin addresses
- The sender must have sufficient balance to cover amounts + fees

## See Also

- [Transfer Multi](./transferMulti.md) - Advanced transfers with UTXO control
- [Submit Raw Transaction](./submitRawTx.md) - Broadcast pre-created transactions
- [Validate Transaction](./validateMneeTx.md) - Validate before broadcasting
- [Check Balance](./balance.md) - Verify sufficient funds