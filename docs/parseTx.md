# Parse Transaction

The MNEE SDK provides methods to parse and analyze MNEE transactions, extracting detailed information about inputs, outputs, and validation status.

## Parse Transaction by ID

The `parseTx` method parses a transaction using its transaction ID.

### Usage

```typescript
const parsed = await mnee.parseTx('txid-here');
console.log('Parsed TX:', parsed);
```

### With Extended Data

```typescript
// Include raw transaction details
const parsed = await mnee.parseTx('txid-here', { includeRaw: true });
console.log('Raw data:', parsed.raw);
```

## Parse Transaction from Raw Hex

The `parseTxFromRawTx` method parses a transaction from its raw hexadecimal representation.

### Usage

```typescript
const parsed = await mnee.parseTxFromRawTx('raw-tx-hex-here');
console.log('Parsed TX:', parsed);
```

### With Extended Data

```typescript
const parsed = await mnee.parseTxFromRawTx('raw-tx-hex', { includeRaw: true });
```

## Parameters

### parseTx
- **txid**: Transaction ID to parse
- **options** (optional): `ParseOptions` object
  - **includeRaw**: Include detailed raw transaction data

### parseTxFromRawTx
- **rawTxHex**: Raw transaction in hexadecimal format
- **options** (optional): Same as above

## Response

Returns a `ParseTxResponse` or `ParseTxExtendedResponse` object.

### Basic Response

```json
{
  "txid": "d7fe19af19332d8ab1d83ed82003ecc41c8c5def8e786b58e90512e82087302a",
  "environment": "production",
  "type": "transfer",
  "inputs": [
    {
      "address": "1Sender...",
      "amount": 10000
    }
  ],
  "outputs": [
    {
      "address": "1Recipient...",
      "amount": 5000
    },
    {
      "address": "1Change...",
      "amount": 4900
    }
  ],
  "isValid": true,
  "inputTotal": "10000",
  "outputTotal": "9900"
}
```

### Extended Response (with includeRaw)

Includes all basic fields plus:

```json
{
  "raw": {
    "txHex": "0100000001...",
    "inputs": [
      {
        "txid": "previous-tx-id",
        "vout": 0,
        "scriptSig": "...",
        "sequence": 4294967295,
        "satoshis": 1000,
        "address": "1Sender...",
        "tokenData": { /* MNEE token data */ }
      }
    ],
    "outputs": [
      {
        "value": 1000,
        "scriptPubKey": "...",
        "address": "1Recipient...",
        "tokenData": { /* MNEE token data */ }
      }
    ],
    "version": 1,
    "lockTime": 0,
    "size": 250,
    "hash": "..."
  }
}
```

## Response Properties

### Basic Properties
- **txid**: Transaction identifier
- **environment**: `"production"` or `"sandbox"`
- **type**: Operation type (`"transfer"`, `"burn"`, etc.)
- **inputs**: Array of input addresses and amounts
- **outputs**: Array of output addresses and amounts
- **isValid**: Whether the transaction is valid
- **inputTotal**: Total input amount (string)
- **outputTotal**: Total output amount (string)

### Extended Properties (raw)
- **txHex**: Complete raw transaction hex
- **inputs**: Detailed input information
- **outputs**: Detailed output information
- **version**: Transaction version
- **lockTime**: Transaction lock time
- **size**: Transaction size in bytes
- **hash**: Transaction hash

## Common Use Cases

### Transaction Analysis

```typescript
async function analyzeTransaction(txid) {
  const parsed = await mnee.parseTx(txid);
  
  console.log(`Transaction ${txid}:`);
  console.log(`- Type: ${parsed.type}`);
  console.log(`- Valid: ${parsed.isValid}`);
  console.log(`- Environment: ${parsed.environment}`);
  
  // Calculate fee
  const fee = parseInt(parsed.inputTotal) - parseInt(parsed.outputTotal);
  console.log(`- Fee: ${mnee.fromAtomicAmount(fee)} MNEE`);
  
  // Analyze flows
  console.log('\nInputs:');
  parsed.inputs.forEach(input => {
    console.log(`  ${input.address}: ${mnee.fromAtomicAmount(input.amount)} MNEE`);
  });
  
  console.log('\nOutputs:');
  parsed.outputs.forEach(output => {
    console.log(`  ${output.address}: ${mnee.fromAtomicAmount(output.amount)} MNEE`);
  });
}
```

### Verify Transaction Before Acceptance

```typescript
async function verifyIncomingTransaction(txid, expectedAmount, senderAddress) {
  const parsed = await mnee.parseTx(txid);
  
  // Check if valid
  if (!parsed.isValid) {
    throw new Error('Invalid transaction');
  }
  
  // Verify sender
  const fromSender = parsed.inputs.some(input => 
    input.address === senderAddress
  );
  if (!fromSender) {
    throw new Error('Transaction not from expected sender');
  }
  
  // Verify amount
  const myAddress = 'my-address';
  const received = parsed.outputs
    .filter(output => output.address === myAddress)
    .reduce((sum, output) => sum + output.amount, 0);
  
  if (received < mnee.toAtomicAmount(expectedAmount)) {
    throw new Error('Insufficient amount received');
  }
  
  return true;
}
```

### Debug Failed Transactions

```typescript
async function debugTransaction(rawTxHex) {
  const parsed = await mnee.parseTxFromRawTx(rawTxHex, { includeRaw: true });
  
  console.log('Transaction Debug Info:');
  console.log(`- Valid: ${parsed.isValid}`);
  console.log(`- Size: ${parsed.raw.size} bytes`);
  console.log(`- Input Total: ${mnee.fromAtomicAmount(parseInt(parsed.inputTotal))} MNEE`);
  console.log(`- Output Total: ${mnee.fromAtomicAmount(parseInt(parsed.outputTotal))} MNEE`);
  
  // Check for common issues
  if (!parsed.isValid) {
    console.log('\n❌ Transaction is invalid');
  }
  
  if (parsed.inputTotal === parsed.outputTotal) {
    console.log('\n⚠️ Warning: No fee included');
  }
  
  // Analyze inputs
  console.log('\nInput Details:');
  parsed.raw.inputs.forEach((input, i) => {
    console.log(`Input ${i}:`);
    console.log(`  Previous TX: ${input.txid}:${input.vout}`);
    console.log(`  Address: ${input.address || 'Unknown'}`);
    console.log(`  Token Data: ${JSON.stringify(input.tokenData)}`);
  });
}
```

### Track Transaction Flow

```typescript
async function trackTokenFlow(startTxid, depth = 3) {
  const flow = [];
  const queue = [{ txid: startTxid, level: 0 }];
  const visited = new Set();
  
  while (queue.length > 0 && queue[0].level < depth) {
    const { txid, level } = queue.shift();
    
    if (visited.has(txid)) continue;
    visited.add(txid);
    
    const parsed = await mnee.parseTx(txid);
    flow.push({ txid, level, parsed });
    
    // Find subsequent transactions
    for (const output of parsed.outputs) {
      // Would need to query for transactions spending these outputs
      // This is a simplified example
    }
  }
  
  return flow;
}
```

### Export Transaction Details

```typescript
async function exportTransactionDetails(txid) {
  const parsed = await mnee.parseTx(txid, { includeRaw: true });
  
  const details = {
    summary: {
      txid: parsed.txid,
      type: parsed.type,
      valid: parsed.isValid,
      fee: parseInt(parsed.inputTotal) - parseInt(parsed.outputTotal),
      timestamp: new Date().toISOString() // Would need block time
    },
    inputs: parsed.inputs.map(input => ({
      address: input.address,
      amount: mnee.fromAtomicAmount(input.amount)
    })),
    outputs: parsed.outputs.map(output => ({
      address: output.address,
      amount: mnee.fromAtomicAmount(output.amount)
    })),
    raw: parsed.raw
  };
  
  return JSON.stringify(details, null, 2);
}
```

### Validate Complex Transactions

```typescript
async function validateComplexTransaction(txid, rules) {
  const parsed = await mnee.parseTx(txid);
  
  const validations = {
    isValid: parsed.isValid,
    hasMinimumFee: false,
    hasExpectedRecipients: false,
    hasNoUnknownOutputs: false
  };
  
  // Check minimum fee
  const fee = parseInt(parsed.inputTotal) - parseInt(parsed.outputTotal);
  validations.hasMinimumFee = fee >= rules.minimumFee;
  
  // Check expected recipients
  validations.hasExpectedRecipients = rules.expectedRecipients.every(
    expected => parsed.outputs.some(
      output => output.address === expected.address && 
                output.amount >= expected.amount
    )
  );
  
  // Check for unknown outputs
  const knownAddresses = new Set([
    ...rules.expectedRecipients.map(r => r.address),
    ...rules.changeAddresses || []
  ]);
  
  validations.hasNoUnknownOutputs = parsed.outputs.every(
    output => knownAddresses.has(output.address)
  );
  
  return validations;
}
```

## Important Notes

- Transaction parsing includes automatic validation
- Amounts in the response are in atomic units
- The `isValid` flag indicates if the transaction follows MNEE protocol rules
- Extended data (`includeRaw: true`) provides blockchain-level details
- Input/output totals are provided as strings to preserve precision

## See Also

- [Validate Transaction](./validateMneeTx.md) - Validate transaction structure
- [Transaction History](./txHistory.md) - Get transaction history
- [Submit Raw Transaction](./submitRawTx.md) - Broadcast transactions