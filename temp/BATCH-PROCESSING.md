# Batch Processing for MNEE SDK

## Overview

The MNEE SDK now includes comprehensive batch processing capabilities to handle large-scale operations efficiently. This addresses the limitation mentioned in the feedback where "the MNEE library or its documented API usage does not provide straightforward bulk/batch operations for /v1/sync and /v1/utxo, which is inefficient for wallet scanning and UTXO fetching for multiple addresses."

The batch processing system provides:
- Automatic chunking of large address lists
- Rate limiting and concurrency control
- Retry logic with exponential backoff
- Progress tracking
- Error recovery strategies
- Parallel processing for maximum efficiency

## When to Use Batch Methods vs Normal Methods

### Use Normal Methods When:

1. **Single Address Operations**
   ```javascript
   // ✅ Use normal method for single address
   const balance = await mnee.balance('1Address...');
   ```

2. **Small, Fixed Sets (1-20 addresses)**
   ```javascript
   // ✅ Use normal method for small sets
   const balances = await mnee.balances(['addr1', 'addr2', 'addr3']);
   ```

3. **Real-time User Interactions**
   ```javascript
   // ✅ Use normal method for immediate user feedback
   const utxos = await mnee.getUtxos(userAddress);
   ```

4. **Simple Applications**
   - Wallet balance checks
   - Single transaction lookups
   - Individual address monitoring

### Use Batch Methods When:

1. **Large Address Sets (20+ addresses)**
   ```javascript
   // ✅ Use batch method for many addresses
   const batch = mnee.batch();
   const result = await batch.getBalances(hundredsOfAddresses, {
     onProgress: (completed, total) => updateProgressBar(completed, total)
   });
   ```

2. **HD Wallet Operations**
   ```javascript
   // ✅ Use batch for HD wallet scanning
   const addresses = generateHDAddresses(0, 1000);
   const batch = mnee.batch();
   const data = await batch.getAll(addresses);
   ```

3. **Data Analysis & Reporting**
   ```javascript
   // ✅ Use batch for analytics
   const batch = mnee.batch();
   const portfolioData = await batch.getAll(customerAddresses, {
     continueOnError: true  // Don't let one error stop analysis
   });
   ```

4. **Background Processing**
   - Scheduled wallet scans
   - Bulk data exports
   - Portfolio tracking
   - Address monitoring services

5. **Unreliable Networks**
   ```javascript
   // ✅ Batch methods handle retries automatically
   const batch = mnee.batch();
   const result = await batch.getUtxos(addresses, {
     maxRetries: 5,
     continueOnError: true
   });
   ```

### Performance Comparison

| Scenario | Normal Method | Batch Method | Recommendation |
|----------|---------------|--------------|----------------|
| 1 address | ~100ms | ~150ms | Use normal |
| 10 addresses | ~1s (sequential) | ~400ms | Use normal |
| 20 addresses | ~2s (single call) | ~600ms | Either works |
| 100 addresses | Multiple calls needed | ~2s | Use batch |
| 1000 addresses | Not practical | ~10s | Must use batch |

### Key Decision Factors

1. **Number of Addresses**
   - < 20: Normal methods are fine
   - 20-100: Consider batch for better performance
   - > 100: Always use batch methods

2. **Error Tolerance**
   - Need all-or-nothing: Use normal methods
   - Can handle partial results: Use batch with `continueOnError`

3. **Progress Feedback**
   - Don't need progress: Either method works
   - Need progress updates: Use batch with `onProgress`

4. **Network Reliability**
   - Stable connection: Either method works
   - Unreliable network: Use batch for automatic retries

### Practical Examples

**Example 1: Checking Your Own Wallet**
```javascript
// ❌ Don't use batch for single address
const result = await mnee.getBalancesBatch([myAddress]);

// ✅ Use normal method
const balance = await mnee.balance(myAddress);
```

**Example 2: Monitoring Customer Wallets (Small Business)**
```javascript
// For 15 customer addresses
const customerAddresses = [...]; // 15 addresses

// ✅ Normal method is fine
const balances = await mnee.balances(customerAddresses);
```

**Example 3: Exchange or Service Provider**
```javascript
// For 500+ customer addresses
const customerAddresses = [...]; // 500 addresses

// ❌ Don't use normal method - will be slow or fail
const balances = await mnee.balances(customerAddresses);

// ✅ Use batch method with progress
const result = await mnee.getBalancesBatch(customerAddresses, {
  onProgress: (completed, total) => {
    console.log(`Processed ${completed}/${total} customers`);
  }
});
```

**Example 4: HD Wallet Recovery**
```javascript
// Scanning HD wallet with unknown number of used addresses

// ❌ Don't check addresses one by one
for (let i = 0; i < 1000; i++) {
  const balance = await mnee.balance(hdAddresses[i]);
}

// ✅ Use batch to scan efficiently
const result = await mnee.getAllDataBatch(hdAddresses, {
  continueOnError: true,
  onProgress: (completed, total) => {
    updateRecoveryProgress(completed, total);
  }
});
```

## Key Features

### 1. Automatic Chunking
- Default chunk size: 20 addresses per API call (configurable)
- Prevents API overload and ensures reliable responses
- Handles any number of addresses transparently

### 2. Rate Limiting
- Built-in rate limiter prevents API throttling
- Configurable concurrent request limits
- Automatic delay between chunks

### 3. Error Recovery
- Automatic retry with exponential backoff
- Continue-on-error mode for resilient processing
- Detailed error reporting with affected addresses

### 4. Progress Tracking
- Real-time progress callbacks
- Track completed chunks and errors
- Monitor processing status for long operations

## Batch Processing Methods

All batch processing is accessed through the `batch()` method, which returns a Batch instance.

### batch.getUtxos

Get UTXOs for multiple addresses with efficient batch processing.

```typescript
const batch = mnee.batch();
const result = await batch.getUtxos(addresses, {
  chunkSize: 20,          // Addresses per chunk
  concurrency: 3,         // Parallel requests
  continueOnError: true,  // Don't stop on errors
  maxRetries: 3,          // Retry failed chunks
  onProgress: (completed, total, errors) => {
    console.log(`Progress: ${completed}/${total}, Errors: ${errors}`);
  }
});

// Access results
result.results.forEach(({ address, utxos }) => {
  console.log(`${address}: ${utxos.length} UTXOs`);
});

// Handle errors
result.errors.forEach(({ items, error }) => {
  console.error(`Failed addresses: ${items.join(', ')}, Error: ${error.message}`);
});
```

### batch.getBalances

Get balances for multiple addresses efficiently.

```typescript
const batch = mnee.batch();
const result = await batch.getBalances(addresses, {
  continueOnError: true,
  onProgress: (completed, total) => {
    const percentage = (completed / total * 100).toFixed(1);
    console.log(`Fetching balances: ${percentage}%`);
  }
});

// Process results
const totalBalance = result.results.reduce(
  (sum, balance) => sum + balance.decimalAmount, 
  0
);
console.log(`Total balance across all addresses: ${totalBalance} MNEE`);
```

### batch.getTxHistories

Get transaction histories for multiple addresses.

```typescript
// Prepare parameters
const params = addresses.map(address => ({
  address,
  limit: 100,      // Transactions per address
  fromScore: 0     // Starting point
}));

const batch = mnee.batch();
const result = await batch.getTxHistories(params, {
  chunkSize: 10,   // Smaller chunks for history queries
  concurrency: 2   // Lower concurrency for complex queries
});

// Process histories
result.results.forEach(history => {
  console.log(`${history.address}: ${history.history.length} transactions`);
});
```

### batch.parseTx

Parse multiple transactions efficiently.

```typescript
const batch = mnee.batch();
const result = await batch.parseTx(txids, {
  parseOptions: { includeRaw: true }, // Optional parsing options
  continueOnError: true,
  onProgress: (completed, total) => {
    console.log(`Parsed ${completed}/${total} transactions`);
  }
});

// Process parsed transactions
result.results.forEach(({ txid, parsed }) => {
  console.log(`Transaction ${txid}:`, parsed);
});
```

### batch.getAll

Get all data (UTXOs, balances, and transaction history) efficiently. This method is optimized to avoid redundant API calls.

```typescript
const batch = mnee.batch();
const data = await batch.getAll(addresses, {
  historyLimit: 50,
  chunkSize: 20,
  concurrency: 5,
  onProgress: (completed, total, errors) => {
    console.log(`Processing: ${completed}/${total} chunks, ${errors} errors`);
  }
});

// UTXOs and histories are fetched in parallel
// Balances are calculated locally from UTXOs (no redundant API calls)
console.log('UTXOs:', data.utxos.results);
console.log('Balances:', data.balances.results);
console.log('Histories:', data.histories.results);

// Check for errors in each operation
if (data.utxos.errors.length > 0) {
  console.error('UTXO errors:', data.utxos.errors);
}
```

## Batch Options

All batch methods accept the following options:

```typescript
interface BatchOptions {
  /** Maximum addresses per API call (default: 20) */
  chunkSize?: number;
  
  /** Number of concurrent requests (default: 3) */
  concurrency?: number;
  
  /** Continue if an error occurs (default: false) */
  continueOnError?: boolean;
  
  /** Progress callback */
  onProgress?: (completed: number, total: number, errors: number) => void;
  
  /** Delay between chunks in ms (default: 100) */
  delayBetweenChunks?: number;
  
  /** Maximum retries per chunk (default: 3) */
  maxRetries?: number;
  
  /** Retry delay in ms (default: 1000) */
  retryDelay?: number;
}
```

### Important: Concurrency and API Rate Limits

**The default concurrency is set to 3, which matches the default rate limit for MNEE API keys.**

You should check your API key's rate limit in the MNEE Developer Portal and adjust the concurrency setting accordingly to avoid rate limit errors:

```javascript
// Default settings (works for most API keys)
const batch = mnee.batch();
const result = await batch.getBalances(addresses);

// If your API key has a higher rate limit (e.g., 10 concurrent requests)
const result = await batch.getBalances(addresses, {
  concurrency: 10,  // Match your API key's rate limit
});

// If your API key has a lower rate limit (e.g., 1 concurrent request)
const result = await batch.getBalances(addresses, {
  concurrency: 1,   // Prevent rate limit errors
});
```

Setting concurrency higher than your API rate limit will result in 429 (Too Many Requests) errors.

## Performance Optimization

### HD Wallet Scanning

When scanning HD wallets with many addresses:

```typescript
// Generate addresses to scan
const hdWallet = mnee.HDWallet(mnemonic, { derivationPath: "m/44'/236'/0'" });
const addresses = [];

// Generate 1000 addresses
for (let i = 0; i < 1000; i++) {
  const addr = hdWallet.deriveAddress(i, false);
  addresses.push(addr.address);
}

// Scan all addresses efficiently
const batch = mnee.batch();
const data = await batch.getAll(addresses, {
  chunkSize: 50,        // Larger chunks for known addresses
  concurrency: 10,      // Higher concurrency for speed
  continueOnError: true,
  onProgress: (completed, total) => {
    const percentage = (completed / total * 100).toFixed(1);
    console.log(`Scanning wallet: ${percentage}%`);
  }
});

// Find funded addresses
const fundedAddresses = data.balances.results
  .filter(b => b.decimalAmount > 0)
  .map(b => b.address);

console.log(`Found ${fundedAddresses.length} funded addresses`);
```

### Large-Scale Analysis

For analyzing thousands of addresses:

```typescript
// Process 10,000 addresses
const addresses = generateLargeAddressList(); // Your address list

const startTime = Date.now();

const batch = mnee.batch();
const result = await batch.getBalances(addresses, {
  chunkSize: 100,       // Maximize chunk size
  concurrency: 20,      // High concurrency
  continueOnError: true,
  delayBetweenChunks: 50, // Minimal delay
  onProgress: (completed, total, errors) => {
    const elapsed = Date.now() - startTime;
    const rate = completed / (elapsed / 1000);
    console.log(`Rate: ${rate.toFixed(1)} chunks/sec, Errors: ${errors}`);
  }
});

const duration = (Date.now() - startTime) / 1000;
console.log(`Processed ${addresses.length} addresses in ${duration}s`);
console.log(`Success rate: ${(result.results.length / addresses.length * 100).toFixed(1)}%`);
```

## Error Handling

### Retry Strategy

Failed chunks are automatically retried with exponential backoff:
- 1st retry: 1 second delay
- 2nd retry: 2 seconds delay
- 3rd retry: 3 seconds delay

### Continue on Error

When `continueOnError` is true, processing continues even if some chunks fail:

```typescript
const batch = mnee.batch();
const result = await batch.getUtxos(addresses, {
  continueOnError: true,
  maxRetries: 5
});

// Process successful results
console.log(`Successfully processed: ${result.results.length}`);

// Handle failed addresses separately
if (result.errors.length > 0) {
  const failedAddresses = result.errors.flatMap(e => e.items);
  console.log(`Failed addresses: ${failedAddresses.length}`);
  
  // Retry failed addresses with different settings
  const retryResult = await batch.getUtxos(failedAddresses, {
    chunkSize: 5,  // Smaller chunks
    concurrency: 1, // Sequential processing
    maxRetries: 10  // More retries
  });
}
```

## Best Practices

### 1. Choose Appropriate Chunk Sizes
- Small chunks (5-10): For unreliable networks or complex queries
- Medium chunks (20-50): Default for most operations
- Large chunks (50-100): For simple queries on reliable networks

### 2. Adjust Concurrency Based on Use Case
- Low (1-3): For rate-limited APIs or complex operations
- Medium (3-10): Default for balanced performance
- High (10-20): For simple queries with good API capacity

### 3. Use Progress Callbacks for UX
```typescript
// Simple progress bar
const showProgress = (completed: number, total: number) => {
  const percentage = Math.round(completed / total * 100);
  const bar = '█'.repeat(percentage / 2) + '░'.repeat(50 - percentage / 2);
  process.stdout.write(`\r[${bar}] ${percentage}%`);
};

const batch = mnee.batch();
await batch.getBalances(addresses, {
  onProgress: showProgress
});
```

### 4. Monitor Error Patterns
```typescript
const batch = mnee.batch();
const result = await batch.getAll(addresses, {
  continueOnError: true
});

// Analyze error patterns
const errorsByType = new Map();
result.utxos.errors.forEach(error => {
  const key = error.error.message;
  errorsByType.set(key, (errorsByType.get(key) || 0) + 1);
});

console.log('Error summary:');
errorsByType.forEach((count, message) => {
  console.log(`  ${message}: ${count} occurrences`);
});
```

## Integration with HD Wallets

Batch processing is particularly useful with HD wallets:

```typescript
// Efficient HD wallet recovery
async function recoverHDWallet(mnemonic: string) {
  const hdWallet = mnee.HDWallet(mnemonic, { derivationPath: "m/44'/236'/0'" });
  
  // Generate addresses to check
  const addressesToCheck = [];
  for (let i = 0; i < 100; i++) {
    addressesToCheck.push(hdWallet.deriveAddress(i, false).address);
    addressesToCheck.push(hdWallet.deriveAddress(i, true).address);
  }
  
  // Check all addresses in parallel
  const batch = mnee.batch();
  const data = await batch.getAll(addressesToCheck, {
    historyLimit: 10,
    requestsPerSecond: 10,  // Higher rate for wallet scanning
    onProgress: (completed, total) => {
      console.log(`Scanning: ${completed}/${total} chunks`);
    }
  });
  
  // Find active addresses
  const activeAddresses = data.utxos.results
    .filter(r => r.utxos.length > 0)
    .map(r => r.address);
  
  console.log(`Found ${activeAddresses.length} active addresses`);
  
  return {
    activeAddresses,
    totalBalance: data.balances.results.reduce((sum, b) => sum + b.decimalAmount, 0),
    totalUtxos: data.utxos.results.reduce((sum, r) => sum + r.utxos.length, 0)
  };
}
```

## Summary

The batch processing functionality in MNEE SDK provides:

1. **Scalability**: Handle thousands of addresses efficiently
2. **Reliability**: Automatic retry and error recovery
3. **Performance**: Parallel processing and rate limiting
4. **Flexibility**: Configurable for different use cases
5. **Monitoring**: Progress tracking and detailed error reporting

This implementation addresses all the batch processing concerns mentioned in the feedback, providing a robust solution for high-throughput MNEE token operations.