# Transfer MNEE

The `transfer` method creates and optionally broadcasts MNEE token transfers. It handles all the complexity of creating valid MNEE transactions, including UTXO selection, fee calculation, and cosigner authorization.

## Usage

### Basic Transfer

```typescript
const recipients = [{ address: 'recipient-address', amount: 2.55 }];
const wif = 'sender-wif-key';

const response = await mnee.transfer(recipients, wif);
console.log('Ticket ID:', response.ticketId);
```

### Multiple Recipients

```typescript
const recipients = [
  { address: 'recipient-1-address', amount: 2.55 },
  { address: 'recipient-2-address', amount: 5 },
  { address: 'recipient-3-address', amount: 0.75 },
];
const wif = 'sender-wif-key';

const response = await mnee.transfer(recipients, wif);
console.log('Ticket ID:', response.ticketId);

// Check status of the transfer
const status = await mnee.getTxStatus(response.ticketId);
console.log('Status:', status);
```

### Create Without Broadcasting

```typescript
const recipients = [{ address: 'recipient-address', amount: 10 }];

// Set broadcast to false to create but not submit
const response = await mnee.transfer(recipients, wif, { broadcast: false });
console.log('Raw transaction:', response.rawtx);
// Ticket ID will not be available when broadcast is false
```

### Transfer with Webhook Callback

```typescript
const recipients = [{ address: 'recipient-address', amount: 10 }];

// Provide webhook URL for async status updates
const response = await mnee.transfer(recipients, wif, {
  broadcast: true,
  callbackUrl: 'https://your-api.com/webhook/mnee',
});

console.log('Ticket ID:', response.ticketId);
// Your webhook will receive status updates as the transaction progresses
```

## Parameters

- **request**: Array of `SendMNEE` objects, each containing:
  - **address**: Recipient Bitcoin address
  - **amount**: Amount to send in MNEE (not atomic units)
- **wif**: Wallet Import Format private key of the sender
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

### Simple Payment

```typescript
async function payInvoice(recipientAddress, amountMNEE, senderWif) {
  try {
    const response = await mnee.transfer([{ address: recipientAddress, amount: amountMNEE }], senderWif);
    console.log(`Payment sent! Ticket: ${response.ticketId}`);

    // Get transaction ID from status
    const status = await mnee.getTxStatus(response.ticketId);
    return status.tx_id;
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
    console.log(`Ticket ID: ${response.ticketId}`);

    // Log each payment
    payments.forEach((p) => {
      console.log(`  - ${p.address}: ${p.amount} MNEE`);
    });

    return response.ticketId;
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
  const txResponse = await mnee.transfer(recipients, wif, { broadcast: false });

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
  return submitResponse.ticketId;
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
    throw new Error(`Insufficient balance. Have ${balance.decimalAmount}, need ${totalNeeded} MNEE`);
  }

  // Proceed with transfer
  const response = await mnee.transfer(recipients, wif);
  console.log(`Transfer complete: ${response.ticketId}`);

  // Get transaction ID
  const status = await mnee.getTxStatus(response.ticketId);
  return status.tx_id;
}
```

### Micro-Payment Channel

```typescript
async function sendMicroPayment(address, amount, wif) {
  const MIN_AMOUNT = 0.001; // 0.001 MNEE minimum

  if (amount < MIN_AMOUNT) {
    throw new Error(`Amount too small. Minimum is ${MIN_AMOUNT} MNEE`);
  }

  const response = await mnee.transfer([{ address, amount }], wif);

  // Get transaction ID from status
  const status = await mnee.getTxStatus(response.ticketId);

  return {
    txid: status.tx_id,
    ticketId: response.ticketId,
    amount: amount,
    timestamp: new Date().toISOString(),
  };
}
```

## Error Handling

The transfer method can throw several specific errors:

```typescript
try {
  const response = await mnee.transfer(recipients, wif);
} catch (error) {
  switch (true) {
    case error.message('Config not fetched'):
      console.error('Failed to fetch cosigner configuration');
      break;
    case error.message('Invalid transfer options'):
      console.error('Invalid recipients or amounts');
      break;
    case error.message('Private key not found'):
      console.error('Invalid WIF private key');
      break;
    case error.message('Invalid amount'):
      console.error('Amount must be greater than 0');
      break;
    case error.message('Insufficient MNEE balance'):
      console.error('Not enough MNEE tokens');
      break;
    case error.message('Failed to broadcast transaction'):
      console.error('Cosigner rejected the transaction');
      break;
    case error.message('Invalid API key'):
      console.error('API key authentication failed (401/403)');
    case error.message.includes('HTTP error! status:'):
      console.error('API request failed:', error.message);
      break;
    default:
      console.error('Transfer failed:', error.message);
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
- When broadcast is true, the transaction is processed asynchronously and you receive a ticketId to track status

## See Also

- [Transfer Multi](./transferMulti.md) - Advanced transfers with UTXO control
- [Submit Raw Transaction](./submitRawTx.md) - Broadcast pre-created transactions
- [Get Transaction Status](./getTxStatus.md) - Track transaction status
- [Transfer Webhooks](./transferWebhook.md) - Webhook callbacks for async updates
- [Validate Transaction](./validateMneeTx.md) - Validate before broadcasting
- [Check Balance](./balance.md) - Verify sufficient funds
