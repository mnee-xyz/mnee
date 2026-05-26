# Parse Transaction

The MNEE SDK provides three methods to parse and analyze MNEE transactions. All three return the same response shape — they differ only in what you supply as input and whether they make network calls.

## Choosing a Parse Method

| Method | You provide | Network calls | Use when |
|---|---|---|---|
| `parseTx(txid)` | transaction ID | fetches raw tx + parent txs from MNEE API | you only have a txid |
| `parseTxFromRawTx(rawHex)` | raw transaction hex | may fetch parent txs from MNEE API | you have raw hex, API lookups are acceptable |
| `parseTxFromBEEF(beefHex)` | BEEF hex | **none** | you need compute-only / offline parsing, or want to avoid API quota |

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

The `parseTxFromRawTx` method parses a transaction from its raw hexadecimal representation. The SDK may fetch parent transactions from the MNEE API to resolve input amounts and addresses.

### Usage

```typescript
const parsed = await mnee.parseTxFromRawTx('raw-tx-hex-here');
console.log('Parsed TX:', parsed);
```

### With Extended Data

```typescript
const parsed = await mnee.parseTxFromRawTx('raw-tx-hex', { includeRaw: true });
```

## Parse Transaction from BEEF

The `parseTxFromBEEF` method parses a transaction from a [BEEF (Bitcoin Extended Format)](https://bsv.brc.dev/transactions/0062) hex string. BEEF embeds parent transactions inline, so input amounts and addresses resolve locally — no network calls are made.

This is the preferred method when:
- you are building a transaction offline and want to inspect it before broadcast
- you want deterministic parsing with no API quota impact
- you already have a BEEF hex from `tx.toHexBEEF()` via `@bsv/sdk`

### Producing a BEEF Hex

```typescript
import { Transaction } from '@bsv/sdk';

// After building and signing your transaction:
const beefHex = tx.toHexBEEF();
```

### Basic Usage

```typescript
const parsed = await mnee.parseTxFromBEEF(beefHex);

console.log(`Type: ${parsed.type}`);
console.log(`Valid: ${parsed.isValid}`);
console.log(`Input total: ${mnee.fromAtomicAmount(parseInt(parsed.inputTotal))} MNEE`);
```

### With Extended Data

```typescript
const parsed = await mnee.parseTxFromBEEF(beefHex, { includeRaw: true });

parsed.raw.inputs.forEach((input, i) => {
  console.log(`Input ${i}: ${input.address ?? 'unknown'} — ${input.satoshis} sats`);
});
```

### Partial BEEF — Missing Parents

A "complete" BEEF (every parent embedded) is often not constructible in practice. The MNEE API cannot serve:
- plain BSV fee inputs (non-MNEE transactions)
- oversized MNEE distribution transactions (e.g. 22 000+ output mints)

`parseTxFromBEEF` handles this gracefully. Inputs whose parent is not embedded resolve as **unknown** rather than throwing:

```
{ address: undefined, amount: 0 }   // in parsed.inputs
{ satoshis: 0, address: undefined } // in parsed.raw.inputs (includeRaw mode)
```

**Consequence:** `inputTotal` may understate the true MNEE value when parents are absent. If an accurate `inputTotal` is required, use `parseTx(txid)` or `parseTxFromRawTx(rawHex)` instead.

### Error Cases

| Situation | Behaviour |
|---|---|
| Malformed BEEF hex | Throws `"Invalid BEEF hex: could not deserialise transaction"` |
| Plain raw hex passed | Throws — raw hex is not silently accepted; use `parseTxFromRawTx` |
| Empty / non-string input | Throws `"A valid BEEF hex string is required"` |

## Parameters

### parseTx
- **txid**: Transaction ID (64-character hex string)
- **options** (optional): `ParseOptions` object
  - **includeRaw**: Include detailed raw transaction data in the response

### parseTxFromRawTx
- **rawTxHex**: Raw transaction in hexadecimal format
- **options** (optional): Same as above

### parseTxFromBEEF
- **beefHex**: BEEF-encoded transaction hex string (produced via `tx.toHexBEEF()`)
- **options** (optional): Same as above

## Response

All three methods return a `ParseTxResponse` or `ParseTxExtendedResponse` object.

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

When parsing via BEEF with missing parents, inputs that could not be resolved appear as:

```json
{ "address": null, "amount": 0 }
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
        "tokenData": { }
      }
    ],
    "outputs": [
      {
        "value": 1000,
        "scriptPubKey": "...",
        "address": "1Recipient...",
        "tokenData": { }
      }
    ]
  }
}
```

## Response Properties

### Basic Properties
- **txid**: Transaction identifier
- **environment**: `"production"` or `"sandbox"`
- **type**: Operation type (`"transfer"`, `"burn"`, `"deploy"`, `"mint"`, `"redeem"`)
- **inputs**: Array of input addresses and amounts
- **outputs**: Array of output addresses and amounts
- **isValid**: Whether the transaction is valid per MNEE protocol rules
- **inputTotal**: Total input amount in atomic units (string, for precision)
- **outputTotal**: Total output amount in atomic units (string, for precision)

### Extended Properties (raw)
- **txHex**: Complete raw transaction hex
- **inputs**: Detailed per-input information (txid, vout, scriptSig, sequence, satoshis, address, tokenData)
- **outputs**: Detailed per-output information (value, scriptPubKey, address, tokenData)

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
  
  if (!parsed.isValid) {
    throw new Error('Invalid transaction');
  }
  
  const fromSender = parsed.inputs.some(input => input.address === senderAddress);
  if (!fromSender) {
    throw new Error('Transaction not from expected sender');
  }
  
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

### Inspect a Transaction Before Broadcast (BEEF)

Use `parseTxFromBEEF` to validate a transaction you built locally before submitting it to the network.

```typescript
import { Transaction } from '@bsv/sdk';

// Build and sign transaction
const tx = new Transaction(/* ... */);
// ... add inputs, outputs, sign ...

const beefHex = tx.toHexBEEF();
const parsed = await mnee.parseTxFromBEEF(beefHex);

if (!parsed.isValid) {
  throw new Error('Transaction does not pass MNEE validation — do not broadcast');
}

console.log(`Type: ${parsed.type}`);
console.log(`Output total: ${mnee.fromAtomicAmount(parseInt(parsed.outputTotal))} MNEE`);

// Note: parsed.inputTotal may be 0 or understated if some parent txs
// are plain BSV inputs that BEEF could not embed.
```

### Debug Failed Transactions

```typescript
async function debugTransaction(rawTxHex) {
  const parsed = await mnee.parseTxFromRawTx(rawTxHex, { includeRaw: true });
  
  console.log('Transaction Debug Info:');
  console.log(`- Valid: ${parsed.isValid}`);
  console.log(`- Input Total: ${mnee.fromAtomicAmount(parseInt(parsed.inputTotal))} MNEE`);
  console.log(`- Output Total: ${mnee.fromAtomicAmount(parseInt(parsed.outputTotal))} MNEE`);
  
  console.log('\nInput Details:');
  parsed.raw.inputs.forEach((input, i) => {
    console.log(`Input ${i}:`);
    console.log(`  Previous TX: ${input.txid}:${input.vout}`);
    console.log(`  Address: ${input.address ?? 'Unknown'}`);
    console.log(`  Token Data: ${JSON.stringify(input.tokenData)}`);
  });
}
```

## Important Notes

- Amounts in all responses are in **atomic units** (multiply by `1e-5` or use `mnee.fromAtomicAmount()`)
- `inputTotal` / `outputTotal` are strings to preserve precision — parse with `parseInt()` or `BigInt()`
- `parseTxFromBEEF` `inputTotal` may understate value when some parent transactions are not embedded
- `isValid` reflects MNEE protocol validity, not BSV consensus validity
- Transaction parsing includes automatic validation against MNEE cosigner scripts

## See Also

- [Validate Transaction](./validateMneeTx.md) - Validate transaction structure
- [Transaction History](./txHistory.md) - Get transaction history
- [Submit Raw Transaction](./submitRawTx.md) - Broadcast transactions
