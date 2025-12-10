# MNEE TypeScript SDK

The MNEE TypeScript SDK provides a comprehensive and efficient way to interact with the MNEE USD token. It offers a full suite of features including balance checking, UTXO management, transaction validation and parsing, token transfers (including multi-source), HD wallet support, and high-performance batch operations for processing large numbers of addresses.

[![Build & Test](https://github.com/mnee-xyz/mnee/actions/workflows/ci.yml/badge.svg)](https://github.com/mnee-xyz/mnee/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/@mnee/ts-sdk.svg)](https://www.npmjs.com/package/@mnee/ts-sdk)

## Documentation

📚 **Full documentation is available at [https://docs.mnee.io](https://docs.mnee.io)**

For detailed API references and advanced usage, see the [docs](./docs) directory:

- [Configuration](./docs/config.md)
- [Balance Operations](./docs/balance.md)
- [Transfers](./docs/transfer.md) & [Multi-source Transfers](./docs/transferMulti.md)
- [Batch Operations](./docs/batch.md)
- [HD Wallet](./docs/hdWallet.md)
- [Transaction Parsing](./docs/parseTx.md)
- [And more...](./docs)

## Installation

```bash
npm install @mnee/ts-sdk
```

## Quick Start

### Basic Setup

```typescript
import Mnee from '@mnee/ts-sdk';

// Initialize the SDK
const mnee = new Mnee({
  environment: 'production', // or 'sandbox'
  apiKey: 'your-api-key', // optional but recommended
});
```

### Check Balance

```typescript
// Single address
const balance = await mnee.balance('1YourAddressHere...');
console.log(`Balance: ${balance.decimalAmount} MNEE`);

// Multiple addresses
const balances = await mnee.balances(['address1', 'address2']);
```

### Transfer MNEE

```typescript
const recipients = [
  { address: '1RecipientAddress...', amount: 10.5 },
  { address: '1AnotherAddress...', amount: 5.25 },
];

const response = await mnee.transfer(recipients, 'your-private-key-wif');
console.log('Ticket ID:', response.ticketId);

// Get transaction ID after broadcast
const status = await mnee.getTxStatus(response.ticketId);
console.log('Transaction ID:', status.tx_id);
```

### HD Wallet

```typescript
import { HDWallet } from '@mnee/ts-sdk';

// Generate a new wallet
const mnemonic = HDWallet.generateMnemonic();
const hdWallet = mnee.HDWallet(mnemonic, {
  derivationPath: "m/44'/236'/0'",
});

// Derive addresses
const address = hdWallet.deriveAddress(0, false);
console.log('Address:', address.address);
console.log('Private Key:', address.privateKey);
```

### Batch Operations

Process hundreds or thousands of addresses efficiently:

```typescript
const batch = mnee.batch();

// Get balances for many addresses with progress tracking
const result = await batch.getBalances(addresses, {
  chunkSize: 50,
  continueOnError: true,
  onProgress: (completed, total, errors) => {
    console.log(`Progress: ${completed}/${total} chunks, Errors: ${errors}`);
  },
});

console.log(`Successfully processed ${result.results.length} addresses`);
console.log(`Errors: ${result.errors.length}`);
```

## Key Features

### 🔐 **HD Wallet Support**

Full BIP32/BIP44 hierarchical deterministic wallet implementation for managing multiple addresses from a single seed.

### ⚡ **Batch Processing**

High-performance batch operations with automatic chunking, rate limiting, and error recovery.

### 💸 **Flexible Transfers**

- Simple transfers with automatic UTXO selection
- Multi-source transfers for complex scenarios
- Support for multiple change addresses

### 🔍 **Transaction Analysis**

- Parse transactions by ID or raw hex
- Validate transactions before broadcasting
- Extract inscription and cosigner data

### 📊 **Comprehensive Data Access**

- Real-time balance queries
- UTXO management
- Transaction history with pagination
- BSV21 token data support

## Common Use Cases

### Portfolio Management

```typescript
// Check total balance across multiple addresses
const addresses = ['address1', 'address2', 'address3'];
const balances = await mnee.balances(addresses);

const total = balances.reduce((sum, bal) => sum + bal.decimalAmount, 0);
console.log(`Total portfolio: ${total} MNEE`);
```

### Automated Payments

```typescript
// Send payments to multiple recipients
const payments = [
  { address: '1Employee1Address...', amount: 1000 },
  { address: '1Employee2Address...', amount: 1500 },
  { address: '1ContractorAddress...', amount: 750 },
];

try {
  const result = await mnee.transfer(payments, payerWif);
  console.log('Payments sent, ticket:', result.ticketId);

  // Wait for confirmation
  const status = await mnee.getTxStatus(result.ticketId);
  console.log('Transaction confirmed:', status.tx_id);
} catch (error) {
  console.error('Payment failed:', error.message);
}
```

### UTXO Consolidation

```typescript
// Consolidate UTXOs from multiple addresses
// Note: getUtxos defaults to 10, specify larger size or use pagination
const utxos = await mnee.getUtxos(['1Address1...', '1Address2...'], 0, 1000);
const inputs = utxos.map((utxo) => ({
  txid: utxo.outpoint.split(':')[0],
  vout: parseInt(utxo.outpoint.split(':')[1]),
  wif: getWifForAddress(utxo.owners[0]),
}));

const totalAmount = utxos.reduce((sum, utxo) => sum + mnee.fromAtomicAmount(utxo.data.bsv21.amt), 0);

const result = await mnee.transferMulti({
  inputs,
  recipients: [
    {
      address: '1ConsolidationAddress...',
      amount: totalAmount - 0.01, // Leave room for fees
    },
  ],
});

// Get transaction ID after broadcast
const status = await mnee.getTxStatus(result.ticketId);
console.log('Consolidation transaction:', status.tx_id);
```

## Error Handling

The SDK provides detailed error messages for common scenarios:

```typescript
try {
  const result = await mnee.transfer(recipients, wif);
} catch (error) {
  switch (true) {
    case error.message.includes('Insufficient MNEE balance'):
      console.error('Not enough tokens');
      break;
    case error.menssage.includes('Invalid API key'):
      console.error('Authentication failed');
      break;
    case error.message.includes('Failed to broadcast transaction'):
      console.error('Transaction rejected by network');
      break;
    default:
      console.error('Transfer failed:', error.message);
  }
}
```

## Unit Conversion

MNEE uses atomic units internally (1 MNEE = 100,000 atomic units):

```typescript
// Convert to atomic units for precise calculations
const atomic = mnee.toAtomicAmount(1.5); // Returns: 150000

// Convert from atomic to MNEE for display
const mneeAmount = mnee.fromAtomicAmount(150000); // Returns: 1.5
```

## Advanced Features

For advanced usage including:

- Transaction validation with custom rules
- Multi-signature support
- Custom change address strategies
- Inscription parsing
- Gap limit scanning for HD wallets
- And more...

Please refer to the [full documentation](https://docs.mnee.io) or the [docs directory](./docs).

## Support

- 📖 Documentation: [https://docs.mnee.io](https://docs.mnee.io)
- 🐛 Issues: [GitHub Issues](https://github.com/mnee-xyz/mnee/issues)

## Contributing

Contributions are welcome! Please submit a pull request or open an issue on the repository to suggest improvements or report bugs.

## Local QA-test
```bash
npm test
```

## License

This project is licensed under the MIT License. See the LICENSE file for details.
