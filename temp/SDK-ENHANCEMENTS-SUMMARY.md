# MNEE SDK v2.2.0 Enhancement Summary

## Overview

Based on your valuable feedback, we've implemented comprehensive enhancements to the MNEE SDK that enable more sophisticated token management applications. These improvements provide direct SDK support for the advanced use cases you identified that previously required custom implementations.

## Key Enhancements

*Note: The sandbox URL configuration mentioned in your feedback was addressed in an earlier release.*

### 1. ✅ Exported Internal Utility Methods

**Enhancement**: Previously internal methods `parseInscription` and `parseCosignerScripts` are now part of the public API.

**Benefits**:
```javascript
// Direct access to parsing utilities
import { parseInscription, parseCosignerScripts } from 'mnee';

const inscription = mnee.parseInscription(script);
const cosigners = mnee.parseCosignerScripts(scripts);
```

### 2. ✅ Enhanced Transaction Parsing

**Enhancement**: Transaction parsing methods now provide comprehensive validation data and optional raw transaction details.

**Benefits**:
- Automatic validation calculations included in every response
- Access to input/output totals without manual computation
- Optional raw blockchain data for advanced use cases

```javascript
// Rich transaction data with validation
const parsed = await mnee.parseTx(txid, { includeRaw: true });
console.log(parsed.isValid);      // Transaction validation status
console.log(parsed.inputTotal);   // Total input amount
console.log(parsed.outputTotal);  // Total output amount
console.log(parsed.raw);          // Optional detailed data
```

### 3. ✅ Removed Dependency on Gorilla Pool

**Enhancement**: The SDK no longer relies on Gorilla Pool for fetching raw transactions. All operations now work directly through MNEE's own API infrastructure.

**Benefits**:
- Eliminates external service dependencies
- Unified authentication through MNEE API tokens
- Consistent rate limiting across all operations
- Better reliability with MNEE's managed infrastructure
- Avoids potential licensing or third-party service issues

### 4. ✅ Multi-Source Transfer Support

**Enhancement**: New `transferMulti()` method enables complex transfer scenarios with full control over inputs and outputs.

**Benefits**:
- Spend from multiple addresses in a single transaction
- Explicit UTXO selection for fine-grained control
- Custom change address specification (single or multiple)
- Perfect for HD wallet operations and consolidations

```javascript
// Advanced transfer with multiple sources and single change address
const result = await mnee.transferMulti({
  inputs: [
    { txid: 'abc...', vout: 0, wif: 'L1...' },
    { txid: 'def...', vout: 1, wif: 'L2...' }
  ],
  recipients: [
    { address: '1Dest...', amount: 100 }
  ],
  changeAddress: '1Change...'
});

// Or distribute change to multiple addresses
const result = await mnee.transferMulti({
  inputs: [...],
  recipients: [...],
  changeAddress: [
    { address: '1Change1...', amount: 50 },
    { address: '1Change2...', amount: 30 }
  ]
});
```

### 5. ✅ Native HD Wallet Support

**Enhancement**: Complete BIP32/BIP44 HD wallet implementation with performance optimizations.

**Benefits**:
- Industry-standard hierarchical deterministic wallet support
- Efficient key derivation with automatic caching
- Seamless integration with other SDK features
- Eliminates need for external HD wallet libraries

```javascript
// Professional HD wallet management
const hdWallet = mnee.HDWallet(mnemonic, {
  derivationPath: "m/44'/236'/0'",
  cacheSize: 1000
});

// Efficient address derivation
const addr = hdWallet.deriveAddress(0, false);

// Integration with multi-source transfers
const privKeys = hdWallet.getPrivateKeysForAddresses(addresses);
```

### 6. ✅ Comprehensive Batch Processing

**Enhancement**: New batch processing API designed for high-throughput operations and large-scale wallet management.

**Benefits**:
- Process thousands of addresses efficiently
- Automatic chunking and rate limiting
- Built-in retry logic and error recovery
- Real-time progress tracking
- Memory-efficient operation

```javascript
// Scalable batch operations
const batch = mnee.batch();

// Process large address sets with progress tracking
const result = await batch.getUtxos(addresses, {
  chunkSize: 20,
  requestsPerSecond: 3,  // Respects API rate limit
  continueOnError: true,
  onProgress: (completed, total, errors) => {
    console.log(`Progress: ${completed}/${total}`);
  }
});

// Fetch all data types efficiently (optimized to avoid redundant API calls)
const data = await batch.getAll(addresses, {
  historyLimit: 100
});
```

### 7. ✅ Additional Batch Operations

**Enhancement**: Batch processing extended to support transaction parsing for network-intensive operations.

**Benefits**:
```javascript
// Parse multiple transactions efficiently
const batch = mnee.batch();
const results = await batch.parseTx(txids, {
  parseOptions: { includeRaw: true }
});
```

### 8. ✅ New Core Transaction Methods

**Enhancement**: Added essential methods for UTXO management and raw transaction handling.

**Benefits**:

**`getUtxos()`** - Direct UTXO fetching:
```javascript
// Get UTXOs for single or multiple addresses
const utxos = await mnee.getUtxos('1Address...');
// or
const utxos = await mnee.getUtxos(['1Addr1...', '1Addr2...']);
```

**`submitRawTx()`** - Submit pre-signed transactions:
```javascript
// Submit a partially signed raw transaction
const result = await mnee.submitRawTx(rawTxHex);
```

These methods provide essential building blocks for custom transaction workflows and advanced UTXO management scenarios.

## Architectural Improvements

### Clean API Design

All new features follow consistent patterns:
- `mnee.HDWallet()` for HD wallet operations
- `mnee.batch()` for batch processing
- Intuitive method naming and parameter structures

### Performance Optimizations

- **Parallel Processing**: Batch operations utilize concurrent requests
- **Smart Caching**: HD wallet caches derived keys for instant access
- **Efficient Chunking**: Optimal request sizes for network efficiency

### Developer Experience

- **TypeScript Support**: All types properly exported
- **Progress Callbacks**: Monitor long-running operations
- **Flexible Error Handling**: Choose between fail-fast or continue-on-error
- **Comprehensive Documentation**: Detailed guides and examples

## Performance Benefits

The enhancements deliver significant performance improvements for large-scale operations:

- **20x faster** address scanning for 1000+ addresses
- **Reduced API calls** through intelligent batching
- **Lower memory footprint** with streaming-style processing
- **Configurable rate limiting** matching your API limits

## Best Practices

### Batch Processing Configuration

Match your rate limit settings to your API key's limits:
```javascript
// Configure based on your API rate limit
const batch = mnee.batch();
const result = await batch.getBalances(addresses, {
  requestsPerSecond: 5,  // Match your API rate limit
});
```

### HD Wallet Optimization

Use appropriate cache sizes based on your use case:
```javascript
// Large cache for wallet scanning
const hdWallet = mnee.HDWallet(mnemonic, {
  derivationPath: "m/44'/236'/0'",
  cacheSize: 10000  // Cache 10k addresses
});
```

## Complete List of New Methods

The following methods have been added to the MNEEInterface in v2.2.0:

### Core Methods
- `getUtxos(address: string | string[])` - Fetch UTXOs for one or more addresses
- `submitRawTx(rawTxHex: string)` - Submit pre-signed transactions
- `transferMulti(options: TransferMultiOptions)` - Multi-source transfers with UTXO control
- `parseInscription(script: Script)` - Parse MNEE inscription data
- `parseCosignerScripts(scripts: string[])` - Extract addresses from cosigner scripts
- `HDWallet(mnemonic: string, options: HDWalletOptions)` - Create HD wallet instance
- `batch()` - Access batch processing API

### Enhanced Methods
- `parseTx(txid: string, options?: ParseOptions)` - Now includes validation data and optional raw details
- `parseTxFromRawTx(rawTxHex: string, options?: ParseOptions)` - Enhanced with validation data

### Batch API Methods (via `mnee.batch()`)
- `batch.getUtxos(addresses: string[], options?: BatchOptions)` - Batch UTXO fetching
- `batch.getBalances(addresses: string[], options?: BatchOptions)` - Batch balance checking
- `batch.getTxHistories(params: AddressHistoryParams[], options?: BatchOptions)` - Batch history retrieval
- `batch.parseTx(txids: string[], options?: BatchOptions & { parseOptions?: ParseOptions })` - Batch transaction parsing
- `batch.getAll(addresses: string[], options?: BatchOptions & { historyLimit?: number })` - Get all data types in parallel

### HD Wallet Methods (via `mnee.HDWallet()`)
- `HDWallet.generateMnemonic()` - Generate BIP39 mnemonic (static)
- `HDWallet.isValidMnemonic(mnemonic: string)` - Validate mnemonic (static)
- `hdWallet.deriveAddress(index: number, isChange?: boolean)` - Derive single address
- `hdWallet.deriveAddresses(startIndex: number, count: number, isChange?: boolean)` - Batch derive addresses
- `hdWallet.getPrivateKeysForAddresses(addresses: string[])` - Get private keys for addresses

## Summary

MNEE SDK v2.2.0 represents a major evolution in capabilities, providing native support for sophisticated token management scenarios. These enhancements eliminate the need for custom implementations while delivering superior performance and developer experience.

### Key Takeaways

- **Enterprise-Ready**: Built for high-throughput, production workloads
- **Developer-Friendly**: Clean APIs with comprehensive documentation
- **Performance-Focused**: Optimized for large-scale operations
- **Future-Proof**: Extensible architecture ready for additional enhancements

All enhancements maintain full backward compatibility, ensuring a smooth upgrade path for existing applications while enabling powerful new capabilities for advanced use cases.