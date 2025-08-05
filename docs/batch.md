# Batch Operations

The MNEE SDK provides a powerful batch processing system for handling multiple operations efficiently. It includes automatic chunking, rate limiting, error recovery, and progress tracking.

## Setup

```typescript
import Mnee from 'mnee';

// Initialize MNEE SDK
const mnee = new Mnee({ apiKey: 'your-api-key' });

// For examples below, assume mnee is already set up
```

## Getting Started

Access batch operations through the `batch()` method:

```typescript
const batch = mnee.batch();
```

## Available Methods

### Get UTXOs for Multiple Addresses

Retrieve UTXOs for multiple addresses with automatic chunking and error handling.

```typescript
const addresses = [
  '1Address1...',
  '1Address2...',
  '1Address3...'
];

const result = await batch.getUtxos(addresses, {
  onProgress: (completed, total, errors) => {
    console.log(`Progress: ${completed}/${total} chunks, Errors: ${errors}`);
  }
});

console.log('Results:', result.results);
console.log('Errors:', result.errors);
```

### Get Balances for Multiple Addresses

Efficiently retrieve balances for multiple addresses.

```typescript
const addresses = ['1Address1...', '1Address2...', '1Address3...'];

const result = await batch.getBalances(addresses);

// Calculate total balance
const totalBalance = result.results.reduce(
  (sum, balance) => sum + balance.decimalAmount, 
  0
);
console.log(`Total: ${totalBalance} MNEE`);
```

### Get Transaction Histories

Retrieve transaction histories for multiple addresses with custom parameters.

```typescript
const params = [
  { address: 'address1', limit: 100 },
  { address: 'address2', fromScore: 850000, limit: 50 },
  { address: 'address3', limit: 200 }
];

const result = await batch.getTxHistories(params);
```

### Parse Multiple Transactions

Parse multiple transactions with optional extended data.

```typescript
const txids = [
  'txid1...',
  'txid2...',
  'txid3...'
];

const result = await batch.parseTx(txids, {
  parseOptions: { includeRaw: true }
});

// Access parsed transactions
result.results.forEach(({ txid, parsed }) => {
  console.log(`${txid}: ${parsed.isValid ? 'Valid' : 'Invalid'}`);
});
```

## Configuration Options

All batch methods support the following options:

```typescript
interface BatchOptions {
  /** Maximum items per API call (default: 20) */
  chunkSize?: number;
  
  /** API requests per second limit (default: 3) */
  requestsPerSecond?: number;
  
  /** Continue processing if an error occurs (default: false) */
  continueOnError?: boolean;
  
  /** Maximum retries per chunk (default: 3) */
  maxRetries?: number;
  
  /** Retry delay in milliseconds (default: 1000) */
  retryDelay?: number;
  
  /** Progress callback (reports chunk progress, not individual items) */
  onProgress?: (completed: number, total: number, errors: number) => void;
}
```

## Response Structure

All batch operations return a `BatchResult`:

```typescript
interface BatchResult<T> {
  results: T[];           // Successful results
  errors: BatchError[];   // Errors encountered
  totalProcessed: number; // Total chunks processed
  totalErrors: number;    // Total errors
}

interface BatchError {
  items: string[];       // Items that failed
  error: {
    message: string;     // Error message
    code?: string;       // Optional error code
  };
  retryCount: number;    // Number of retries attempted
}
```

## Common Use Cases

### Portfolio Balance Check

```typescript
async function getPortfolioBalance(mnee, addresses) {
  const batch = mnee.batch();
  const result = await batch.getBalances(addresses, {
    chunkSize: 50,
    continueOnError: true,
    onProgress: (completed, total) => {
      console.log(`Processed ${completed}/${total} batches`);
    }
  });

  // Calculate statistics
  const stats = {
    totalBalance: 0,
    addressesWithBalance: 0,
    errors: result.errors.length
  };

  result.results.forEach(balance => {
    stats.totalBalance += balance.decimalAmount;
    if (balance.amount > 0) {
      stats.addressesWithBalance++;
    }
  });

  return stats;
}
```

### UTXO Collection

```typescript
async function collectAllUtxos(mnee, addresses) {
  const batch = mnee.batch();
  const result = await batch.getUtxos(addresses, {
    continueOnError: true,
    chunkSize: 100
  });

  // Flatten UTXOs
  const allUtxos = result.results.flatMap(r => r.utxos);
  
  // Calculate total value
  const totalValue = allUtxos.reduce(
    (sum, utxo) => sum + utxo.data.bsv21.amt, 
    0
  );

  console.log(`Found ${allUtxos.length} UTXOs`);
  console.log(`Total value: ${mnee.fromAtomicAmount(totalValue)} MNEE`);
  
  return allUtxos;
}
```

### Transaction Analysis

```typescript
async function analyzeTransactions(mnee, txids) {
  const batch = mnee.batch();
  const result = await batch.parseTx(txids, {
    parseOptions: { includeRaw: true },
    continueOnError: true,
    onProgress: (completed, total, errors) => {
      const percentage = Math.round((completed / total) * 100);
      console.log(`${percentage}% complete (${errors} errors)`);
    }
  });

  const analysis = {
    valid: 0,
    invalid: 0,
    types: {},
    totalFees: 0
  };

  result.results.forEach(({ parsed }) => {
    if (parsed.isValid) {
      analysis.valid++;
      analysis.types[parsed.type] = (analysis.types[parsed.type] || 0) + 1;
      
      const fee = parseInt(parsed.inputTotal) - parseInt(parsed.outputTotal);
      analysis.totalFees += fee;
    } else {
      analysis.invalid++;
    }
  });

  return analysis;
}
```

### Error Recovery

```typescript
async function robustBatchProcess(mnee, addresses) {
  const batch = mnee.batch();
  const result = await batch.getBalances(addresses, {
    continueOnError: true,
    maxRetries: 5,
    retryDelay: 2000
  });

  // Process successful results
  console.log(`Successfully processed: ${result.results.length}`);

  // Handle errors
  if (result.errors.length > 0) {
    console.log(`Failed items: ${result.totalErrors}`);
    
    // Retry failed addresses individually
    for (const error of result.errors) {
      console.log(`Error for ${error.items.join(', ')}: ${error.error.message}`);
      
      // Could implement custom retry logic here
    }
  }

  return result;
}
```

### High-Performance Processing

```typescript
async function highPerformanceScan(mnee, addresses) {
  const batch = mnee.batch();
  // Adjust for higher API limits if available
  const result = await batch.getUtxos(addresses, {
    chunkSize: 100,        // Larger chunks
    requestsPerSecond: 10, // Higher rate limit
    continueOnError: true
  });

  return result;
}
```

### Progress Monitoring

```typescript
async function monitoredBatchOperation(mnee, addresses) {
  const batch = mnee.batch();
  const startTime = Date.now();
  
  const result = await batch.getBalances(addresses, {
    onProgress: (completed, total, errors) => {
      const elapsed = Date.now() - startTime;
      const rate = completed / (elapsed / 1000);
      const remaining = total - completed;
      const eta = remaining / rate;
      
      console.log(`Progress: ${completed}/${total}`);
      console.log(`Rate: ${rate.toFixed(2)} chunks/sec`);
      console.log(`ETA: ${eta.toFixed(0)} seconds`);
      console.log(`Errors: ${errors}`);
    }
  });

  const totalTime = (Date.now() - startTime) / 1000;
  console.log(`Completed in ${totalTime.toFixed(2)} seconds`);
  
  return result;
}
```

### Batch History Export

```typescript
async function exportAllHistories(mnee, addresses, outputFile) {
  const batch = mnee.batch();
  const params = addresses.map(addr => ({ 
    address: addr, 
    limit: 1000 
  }));

  const result = await batch.getTxHistories(params, {
    chunkSize: 10,
    continueOnError: true
  });

  // Convert to CSV
  const csv = ['Address,TxID,Type,Amount,Status'];
  
  result.results.forEach(history => {
    history.history.forEach(tx => {
      csv.push([
        history.address,
        tx.txid,
        tx.type,
        mnee.fromAtomicAmount(tx.amount),
        tx.status
      ].join(','));
    });
  });

  return csv.join('\n');
}
```

## Best Practices

### Chunk Size Optimization

- **Small operations**: Use default chunk size (20)
- **Large datasets**: Increase to 50-100 for better performance
- **Rate-limited APIs**: Reduce chunk size to avoid hitting limits

### Error Handling

- Use `continueOnError: true` for resilient processing
- Check the `errors` array in the response
- Implement custom retry logic for critical operations

### Performance Tips

- Adjust `requestsPerSecond` based on your API limits
- Use progress callbacks for long-running operations
- Process results as they complete rather than waiting for all

### Memory Management

- For very large datasets, process results incrementally
- Clear processed data from memory when no longer needed
- Consider streaming results to disk for massive operations

## Rate Limiting

The batch system includes intelligent rate limiting:

- Respects the configured `requestsPerSecond` limit
- Automatically handles concurrent request management
- Ensures minimum delay between API calls
- Works efficiently even with fractional rates (e.g., 0.5 requests/second)

## Error Types

Common errors you might encounter:

1. **Invalid Input**: Empty or malformed addresses/txids
2. **API Errors**: Network issues or service unavailability
3. **Rate Limit**: Exceeded API rate limits
4. **Validation Errors**: Invalid Bitcoin addresses or transaction IDs

## See Also

- [Get UTXOs](./getUtxos.md) - Single address UTXO retrieval
- [Balance](./balance.md) - Single address balance check
- [Transaction History](./txHistory.md) - Single address history
- [Parse Transaction](./parseTx.md) - Single transaction parsing