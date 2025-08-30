# MNEE SDK Complete Reference

This document provides comprehensive documentation for the MNEE SDK, designed to give LLMs full context for working with the SDK.

## Table of Contents

1. [Setup and Configuration](#setup-and-configuration)
2. [Core Methods](#core-methods)
3. [Batch Operations](#batch-operations)
4. [HD Wallet](#hd-wallet)
5. [Type Definitions](#type-definitions)
6. [Webhook Support](#webhook-support)

## Setup and Configuration

### Installation and Initialization

```typescript
import Mnee from 'mnee';

// Initialize MNEE SDK
const mnee = new Mnee({
  environment: 'production', // or 'sandbox' (required)
  apiKey: 'your-api-key', // optional but recommended
});

// All types are also exported from the main module
import {
  MNEEBalance,
  MNEEUtxo,
  TransferResponse,
  HDWallet,
  // ... and more
} from 'mnee';
```

#### SdkConfig Type

```typescript
type SdkConfig = {
  environment: 'production' | 'sandbox';
  apiKey?: string;
};
```

### Configuration

The `config()` method retrieves the current MNEE service configuration including fee structure and system addresses.

```typescript
const config = await mnee.config();
```

#### Response Structure

```typescript
interface MNEEConfig {
  approver: string; // Cosigner public key
  feeAddress: string; // Fee collection address
  burnAddress: string; // Burn operations address
  mintAddress: string; // Mint operations address
  fees: FeeTier[]; // Fee structure tiers
}

interface FeeTier {
  min: number; // Minimum amount (atomic units)
  max: number; // Maximum amount (atomic units)
  fee: number; // Fee amount (atomic units)
}
```

## Core Methods

### Balance Operations

#### Single Address Balance

```typescript
const balance = await mnee.balance('address');
// Returns: { address: string, amount: number, decimalAmount: number }
```

#### Multiple Address Balances

```typescript
const balances = await mnee.balances(['address1', 'address2']);
// Returns: MNEEBalance[]
```

### UTXO Operations

```typescript
// Single address (returns up to 10 UTXOs by default)
const utxos = await mnee.getUtxos('address');

// With pagination
const utxos = await mnee.getUtxos('address', 0, 100, 'desc');
// Parameters: address, page, size (max 1000), order ('asc' | 'desc')

// Multiple addresses
const utxos = await mnee.getUtxos(['address1', 'address2'], 0, 50);
// Returns: MNEEUtxo[]

// Get just enough UTXOs for a specific amount (optimized for transfers)
const requiredAmount = mnee.toAtomicAmount(5.0); // Convert 5 MNEE to atomic units
const enoughUtxos = await mnee.getEnoughUtxos('address', requiredAmount);
// Returns: MNEEUtxo[] - stops fetching once sufficient amount is reached

// Get ALL UTXOs for an address (comprehensive wallet view)
const allUtxos = await mnee.getAllUtxos('address');
// Returns: MNEEUtxo[] - fetches every UTXO for the address
```

#### UTXO Structure (BSV21)

```typescript
interface MNEEUtxo {
  txid: string;
  vout: number;
  outpoint: string; // "txid_vout"
  satoshis: number;
  accSats: number;
  script: string;
  owners: string[];
  data: {
    types: string[];
    insc: {
      json: any;
      text: string;
      words: string[];
      file: {
        hash: string;
        size: number;
        type: string;
      };
    };
    map: { [key: string]: any };
    b: {
      hash: string;
      size: number;
      type: string;
    };
    sigmas: Array<{ algorithm: string; address: string; signature: string; index?: number }>;
    list: {
      payout: Array<{ address: string; value: number }>;
      lock: { until: number };
    };
    bsv20: { [key: string]: any };
    bsv21: {
      id: string; // Token ID
      p: string; // Protocol
      op: string; // Operation
      amt: number; // Amount in atomic units
      sym: string; // Symbol
      icon: string; // Icon URL
      dec: number; // Decimals
    };
  };
}
```

### Transfer Operations

#### Simple Transfer

```typescript
const recipients: SendMNEE[] = [
  { address: 'recipient1', amount: 10.5 },
  { address: 'recipient2', amount: 5.25 },
];

const response = await mnee.transfer(
  recipients,
  'sender-private-key-wif',
  { broadcast: true, callbackUrl: 'https://your-api.com/webhook' }, // optional
);
// Returns: TransferResponse

// Get transaction ID from status
const status = await mnee.getTxStatus(response.ticketId);
console.log('Transaction ID:', status.tx_id);
```

#### Multi-Source Transfer

```typescript
const options: TransferMultiOptions = {
  inputs: [
    { txid: 'txid1', vout: 0, wif: 'wif1' },
    { txid: 'txid2', vout: 1, wif: 'wif2' },
  ],
  recipients: [
    { address: 'recipient1', amount: 15.75 },
    { address: 'recipient2', amount: 8.5 },
  ],
  changeAddress: 'change-address', // optional
};

const response = await mnee.transferMulti(options, { broadcast: true });
// Returns: TransferResponse

// Get transaction ID from status
const status = await mnee.getTxStatus(response.ticketId);
console.log('Transaction ID:', status.tx_id);
```

#### Transfer Response

```typescript
interface TransferResponse {
  ticketId?: string; // Ticket ID for tracking (only if broadcast is true)
  rawtx?: string; // The raw transaction hex (only if broadcast is false)
}
```

#### Transaction Status

```typescript
const status = await mnee.getTxStatus(ticketId);
// Returns: TransferStatus

interface TransferStatus {
  id: string;
  tx_id: string;
  tx_hex: string;
  action_requested: 'transfer';
  status: 'BROADCASTING' | 'SUCCESS' | 'MINED' | 'FAILED';
  createdAt: string;
  updatedAt: string;
  errors: string | null;
}
```

### Transaction Validation

```typescript
const isValid = await mnee.validateMneeTx(rawTxHex);
// Or with expected recipients
const isValid = await mnee.validateMneeTx(rawTxHex, recipients);
// Returns: boolean
```

### Submit Raw Transaction

```typescript
const response = await mnee.submitRawTx(rawTxHex, {
  broadcast: true,
  callbackUrl: 'https://your-api.com/webhook', // optional
});
// Returns: TransferResponse with ticketId

// Get transaction ID from status
const status = await mnee.getTxStatus(response.ticketId);
console.log('Transaction ID:', status.tx_id);
```

### Unit Conversion

```typescript
// Convert MNEE to atomic units (1 MNEE = 100,000 atomic)
const atomic = mnee.toAtomicAmount(1.5); // Returns: 150000

// Convert atomic units to MNEE
const mneeAmount = mnee.fromAtomicAmount(150000); // Returns: 1.5
```

### Transaction History

#### Single Address History

```typescript
const history = await mnee.recentTxHistory(address, fromScore, limit);
// Returns: TxHistoryResponse
```

#### Multiple Address Histories

```typescript
const params: AddressHistoryParams[] = [
  { address: 'address1', limit: 100 },
  { address: 'address2', fromScore: 850000, limit: 50 },
];
const histories = await mnee.recentTxHistories(params);
// Returns: TxHistoryResponse[]
```

#### History Response Structure

```typescript
interface TxHistoryResponse {
  address: string;
  history: TxHistory[];
  nextScore: number;
}

interface TxHistory {
  txid: string;
  height: number; // 0 for unconfirmed
  status: 'confirmed' | 'unconfirmed';
  type: 'send' | 'receive';
  amount: number; // Atomic units
  counterparties: Array<{ address: string; amount: number }>;
  fee: number;
  score: number; // For pagination
}
```

### Transaction Parsing

#### Parse by Transaction ID

```typescript
const parsed = await mnee.parseTx(txid);
// With extended data
const parsed = await mnee.parseTx(txid, { includeRaw: true });
// Returns: ParseTxResponse | ParseTxExtendedResponse
```

#### Parse from Raw Transaction

```typescript
const parsed = await mnee.parseTxFromRawTx(rawTxHex);
// With extended data
const parsed = await mnee.parseTxFromRawTx(rawTxHex, { includeRaw: true });
```

#### Parse Response Structure

```typescript
interface ParseTxResponse {
  txid: string;
  environment: 'production' | 'sandbox';
  type: string; // 'transfer', 'burn', etc.
  inputs: Array<{ address: string; amount: number }>;
  outputs: Array<{ address: string; amount: number }>;
  isValid: boolean;
  inputTotal: string; // String to preserve precision
  outputTotal: string; // String to preserve precision
}

interface ParseTxExtendedResponse extends ParseTxResponse {
  raw: {
    txHex: string;
    inputs: Array<{
      txid: string;
      vout: number;
      scriptSig: string;
      sequence: number;
      satoshis: number;
      address: string;
      tokenData: any;
    }>;
    outputs: Array<{
      value: number;
      scriptPubKey: string;
      address: string;
      tokenData: any;
    }>;
    version: number;
    lockTime: number;
    size: number;
    hash: string;
  };
}
```

### Script Parsing

#### Parse Inscription

```typescript
import { Script } from '@bsv/sdk';

const script = Script.fromHex('...');
const inscription = mnee.parseInscription(script);
// Returns: Inscription | undefined
```

#### Parse Cosigner Scripts

```typescript
const scripts = [Script.fromHex('...'), Script.fromHex('...')];
const cosigners = mnee.parseCosignerScripts(scripts);
// Returns: ParsedCosigner[]
```

#### Inscription Structure

```typescript
interface Inscription {
  file?: {
    hash: string;
    size: number;
    type: string;
    content: number[];
  };
  fields?: { [key: string]: any };
  parent?: string;
}

interface ParsedCosigner {
  cosigner: string; // Public key
  address: string; // Bitcoin address
}
```

## Batch Operations

### Setup

```typescript
const batch = mnee.batch();
```

### Batch Configuration

```typescript
interface BatchOptions {
  chunkSize?: number; // Max items per API call (default: 20)
  requestsPerSecond?: number; // Rate limit (default: 3)
  continueOnError?: boolean; // Continue on error (default: false)
  maxRetries?: number; // Max retries per chunk (default: 3)
  retryDelay?: number; // Retry delay in ms (default: 1000)
  onProgress?: (completed: number, total: number, errors: number) => void;
}
```

### Batch Methods

#### Get UTXOs

```typescript
const result = await batch.getUtxos(addresses, options);
// Returns: BatchResult<BatchUtxoResult>
```

#### Get Balances

```typescript
const result = await batch.getBalances(addresses, options);
// Returns: BatchResult<MNEEBalance>
```

#### Get Transaction Histories

```typescript
const params = addresses.map((addr) => ({ address: addr, limit: 100 }));
const result = await batch.getTxHistories(params, options);
// Returns: BatchResult<TxHistoryResponse>
```

#### Parse Transactions

```typescript
const result = await batch.parseTx(txids, {
  parseOptions: { includeRaw: true },
  ...batchOptions,
});
// Returns: BatchResult<BatchParseTxResult>
```

### Batch Response Structure

```typescript
interface BatchResult<T> {
  results: T[];
  errors: BatchError[];
  totalProcessed: number;
  totalErrors: number;
}

interface BatchError {
  items: string[];
  error: {
    message: string;
    code?: string;
  };
  retryCount: number;
}

interface BatchUtxoResult {
  address: string;
  utxos: MNEEUtxo[];
}

interface BatchParseTxResult {
  txid: string;
  parsed: ParseTxResponse | ParseTxExtendedResponse;
}
```

## HD Wallet

### Setup

```typescript
import Mnee, { HDWallet } from 'mnee';

const mnee = new Mnee({
  environment: 'production', // required
  apiKey: 'your-api-key', // optional but recommended
});
```

### Static Methods

```typescript
// Static methods can be accessed via Mnee.HDWallet or imported HDWallet
import Mnee, { HDWallet } from 'mnee';

// Generate new mnemonic (12 words)
const mnemonic = HDWallet.generateMnemonic();
// or
const mnemonic = Mnee.HDWallet.generateMnemonic();

// Validate mnemonic
const isValid = HDWallet.isValidMnemonic(mnemonic);
// or
const isValid = Mnee.HDWallet.isValidMnemonic(mnemonic);
```

### Create HD Wallet

```typescript
const hdWallet = mnee.HDWallet(mnemonic, {
  derivationPath: "m/44'/236'/0'", // BIP44 path
  cacheSize: 1000, // Optional cache size
});
```

### Derive Addresses

#### Single Address

```typescript
// Receive address (change = false)
const addressInfo = hdWallet.deriveAddress(0, false);
// Change address (change = true)
const changeInfo = hdWallet.deriveAddress(0, true);

// AddressInfo structure
{
  address: string; // Bitcoin address
  privateKey: string; // WIF format
  path: string; // Full derivation path
}
```

#### Multiple Addresses

```typescript
const addresses = await hdWallet.deriveAddresses(0, 10, false);
// Returns: AddressInfo[]
```

### Get Private Keys

```typescript
// Get private keys for specific addresses
const result = hdWallet.getPrivateKeysForAddresses(addresses, {
  maxScanReceive: 10000,
  maxScanChange: 10000,
  scanStrategy: 'parallel', // or 'sequential'
});
// Returns: { privateKeys: {}, paths: {} }

// Simplified version
const privateKeys = hdWallet.getPrivateKeys(addresses, options);
// Returns: { [address: string]: string }
```

### Scan with Gap Limit

```typescript
const checkAddressUsed = async (address) => {
  const balance = await mnee.balance(address);
  return balance.amount > 0;
};

const discovered = await hdWallet.scanAddressesWithGapLimit(checkAddressUsed, {
  gapLimit: 20,
  scanChange: true,
  maxScan: 10000,
});
// Returns: { receive: AddressInfo[], change: AddressInfo[] }
```

### Cache Management

```typescript
hdWallet.clearCache();
const cacheSize = hdWallet.getCacheSize();
```

## Important Notes

### Unit System

- 1 MNEE = 100,000 atomic units
- All blockchain operations use atomic units
- User-facing amounts should be in MNEE (decimal)
- SDK methods expecting amounts use MNEE values (not atomic)

### Address Validation

- Bitcoin addresses starting with 1, 3, or bc1
- Invalid addresses in batch operations are handled based on `continueOnError` setting

### Error Handling

The SDK throws standard JavaScript Error objects with descriptive messages. Common error scenarios:

#### Initialization Errors

- `"Invalid environment. Must be either 'production' or 'sandbox'"` - Invalid environment parameter
- `"MNEE API key cannot be an empty string"` - Empty API key provided
- `"Invalid API key"` - API key authentication failed

#### Validation Errors

- `"Invalid Bitcoin address: <address>"` - Address format validation failed
- `"No valid Bitcoin addresses provided"` - No valid addresses in batch
- `"Invalid transaction ID: empty or not a string"` - Invalid transaction ID format
- `"Invalid transaction ID format: <txid>"` - Transaction ID not 64 hex characters

#### Batch Operation Errors

- `"Input must be an array of addresses"` - Non-array input to batch methods
- `"Input must be an array of transaction IDs"` - Non-array input to parseTx
- `"Max retries exceeded"` - Batch operation failed after all retries

#### HD Wallet Errors

- `"Invalid mnemonic phrase"` - Invalid BIP39 mnemonic
- `"Failed to derive private key for path: <path>"` - Derivation failure
- `"Could not find private keys for <n> address(es)"` - Address not found in HD wallet scan

#### Transfer/Submit Errors (POST methods)

- `"Config not fetched"` - Failed to get cosigner configuration
- `"Insufficient MNEE balance"` - Not enough tokens for transfer
- `"Failed to broadcast transaction"` - Cosigner rejected transaction
- `"Failed to submit raw transaction"` - Submit raw tx failed

#### Error Handling Patterns

```typescript
// Basic error handling
try {
  const result = await mnee.transfer(recipients, wif);
} catch (error) {
  console.error('Transfer failed:', error.message);
}

// Batch operations with continueOnError
const result = await batch.getBalances(addresses, {
  continueOnError: true, // Continue processing on errors
});

// Check for partial failures
if (result.errors.length > 0) {
  result.errors.forEach((error) => {
    console.log(`Failed addresses: ${error.items.join(', ')}`);
    console.log(`Error: ${error.error.message}`);
  });
}

// Handle API authentication errors
try {
  const result = await mnee.transfer(recipients, wif);
} catch (error) {
  if (error.message === 'Invalid API key') {
    // Handle authentication failure (401/403)
  } else if (error.message.includes('HTTP error! status:')) {
    // Handle other HTTP errors
  }
}
```

Note: When methods make POST requests to the cosigner API (transfer, transferMulti, submitRawTx), they handle HTTP 401/403 as "Invalid API key" and other HTTP errors as "HTTP error! status: {code}".

## Webhook Support

Transactions can be tracked via webhook callbacks for real-time status updates.

### Webhook Response Format

```typescript
interface TransferWebhookResponse {
  id: string; // The ticket ID
  tx_id: string; // The blockchain transaction ID
  tx_hex: string; // The raw transaction hex
  action_requested: 'transfer'; // Always 'transfer' for MNEE transactions
  callback_url: string; // Your webhook URL (for verification)
  status: 'BROADCASTING' | 'SUCCESS' | 'MINED' | 'FAILED';
  createdAt: string; // ISO timestamp when ticket was created
  updatedAt: string; // ISO timestamp of this update
  errors: string | null; // Error details if status is FAILED
}
```

### Using Webhooks

```typescript
// Transfer with webhook
const response = await mnee.transfer(recipients, wif, {
  broadcast: true,
  callbackUrl: 'https://your-api.com/webhook',
});

// TransferMulti with webhook
const response = await mnee.transferMulti(options, {
  broadcast: true,
  callbackUrl: 'https://your-api.com/webhook',
});

// Submit raw transaction with webhook
const response = await mnee.submitRawTx(rawTxHex, {
  broadcast: true,
  callbackUrl: 'https://your-api.com/webhook',
});
```

### Webhook Status Flow

- **BROADCASTING** → Transaction is being broadcast to the network
- **SUCCESS** → Transaction successfully broadcast and accepted by the network
- **MINED** → Transaction has been mined into a block
- **FAILED** → Transaction failed (check `errors` field for details)

### Performance

- Batch operations automatically chunk requests
- Rate limiting prevents API throttling
- Progress callbacks report chunk completion, not individual items
- HD wallet caches derived addresses for performance

### Security

- Never store private keys or mnemonics in plain text
- Use WIF format for private keys
- HD wallet follows BIP32/BIP44 standards
- Cosigner validation available via config and script parsing
