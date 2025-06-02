# MNEE TypeScript SDK

**⚠️ Beta Notice**: This SDK is in beta and scheduled for a security audit. It has undergone extensive testing, but you should treat it as experimental until the audit and full QA are complete.

The MNEE TypeScript SDK provides a simple and efficient way to interact with the MNEE USD token. It allows developers to retrieve configuration, check balances (single or batch), validate transactions, transfer MNEE tokens, fetch transaction history, parse transactions, and convert between human and atomic units.

## Features

- Retrieve MNEE service configuration
- Check the balance of an address or multiple addresses
- Validate MNEE transactions (basic and deep validation)
- Transfer MNEE tokens
- Convert amounts to and from atomic units for precise calculations
- Fetch recent transaction history (single or batch)
- Parse transactions by txid or raw hex

## Installation

To use this SDK in your project, install it via npm:

```bash
npm install mnee
```

## Usage

### Initialization

```typescript
import Mnee from 'mnee';

// Initialize with environment and optional API key
const mnee = new Mnee({
  environment: 'production', // or 'sandbox'
  apiKey: 'your-api-token',  // optional
});
```

### Checking a Balance

#### Single Address
```typescript
const balance = await mnee.balance('your-address-here');
console.log('Balance:', balance);
```

#### Multiple Addresses
```typescript
const balances = await mnee.balances(['address1', 'address2']);
console.log('Balances:', balances);
```

### Transferring MNEE Tokens

```typescript
const request = [
  { address: 'recipient-1-address', amount: 2.55 },
  { address: 'recipient-2-address', amount: 5 },
];
const wif = 'sender-wif-key';
const response = await mnee.transfer(request, wif);
console.log('Transfer Response:', response);
```

### Validating a Transaction

#### Basic Validation
```typescript
const rawtx = '0100000002b170f2d41764c...'; // raw tx hex
const isValid = await mnee.validateMneeTx(rawtx);
```

#### Deep Validation (with expected outputs)
```typescript
const isValid = await mnee.validateMneeTx(rawtx, [
  { address: 'recipient-1-address', amount: 1 },
  { address: 'recipient-2-address', amount: 10.25 },
]);
```

### Converting to and from Atomic Amounts

```typescript
const atomic = mnee.toAtomicAmount(1.5);
console.log('Atomic Amount:', atomic); // e.g. 150000

const human = mnee.fromAtomicAmount(150000);
console.log('Human Amount:', human); // 1.5
```

### Fetching Transaction History

#### Single Address
```typescript
const history = await mnee.recentTxHistory('your-address-here');
console.log('History:', history);
```

#### Multiple Addresses (Batch)
```typescript
const histories = await mnee.recentTxHistories([
  { address: 'address1' },
  { address: 'address2', fromScore: 0, limit: 10 },
]);
console.log('Histories:', histories);
```

### Parsing Transactions

#### By Transaction ID
```typescript
const parsed = await mnee.parseTx('txid-here');
console.log('Parsed TX:', parsed);
```

#### By Raw Transaction Hex
```typescript
const parsed = await mnee.parseTxFromRawTx('raw-tx-hex-here');
console.log('Parsed TX:', parsed);
```

## Types Overview

- `SdkConfig`: `{ environment: 'production' | 'sandbox', apiKey?: string }`
- `MNEEBalance`: `{ address: string, amount: number, decimalAmount: number }`
- `SendMNEE`: `{ address: string, amount: number }`
- `TransferResponse`: `{ txid?: string, rawtx?: string, error?: string }`
- `TxHistoryResponse`: `{ address: string, history: TxHistory[], nextScore: number }`
- `ParseTxResponse`: `{ txid: string, environment: string, type: string, inputs: TxAddressAmount[], outputs: TxAddressAmount[] }`

## Configuration & Environments

- `environment`: Set to `'production'` for mainnet or `'sandbox'` for testnet/sandbox usage.
- `apiKey`: (Optional) Your API key for the MNEE service. If not provided, a default key is used (suitable for most public/test use cases).

## Contributing

Contributions are welcome! Please submit a pull request or open an issue on the repository to suggest improvements or report bugs.

## License

This project is licensed under the MIT License. See the LICENSE file for details.
