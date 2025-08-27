# Get Transaction Status

The `getTxStatus` method retrieves the current status of a transaction that was submitted asynchronously. When you submit a transaction using `transfer`, `transferMulti`, or `submitRawTx` with `broadcast: true`, you receive a `ticketId` that can be used to track the transaction's progress.

## Usage

### Basic Status Check

```typescript
const ticketId = 'abc123-def456-789'; // From transfer response

const status = await mnee.getTxStatus(ticketId);
console.log('Transaction status:', status.status);
console.log('Transaction ID:', status.tx_id);
```

### Poll Until Complete

```typescript
async function waitForTransaction(ticketId) {
  let status;
  let attempts = 0;
  const maxAttempts = 30; // 60 seconds with 2-second intervals
  
  while (attempts < maxAttempts) {
    status = await mnee.getTxStatus(ticketId);
    
    if (status.status === 'SUCCESS' || status.status === 'MINED') {
      console.log('Transaction confirmed:', status.tx_id);
      return status;
    }
    
    if (status.status === 'FAILED') {
      throw new Error(`Transaction failed: ${status.errors}`);
    }
    
    // Still broadcasting, wait and retry
    await new Promise(resolve => setTimeout(resolve, 2000));
    attempts++;
  }
  
  throw new Error('Transaction timeout after 60 seconds');
}
```

## Parameters

- **ticketId**: The ticket ID returned from a transfer or submitRawTx operation

## Response

Returns a `TransferStatus` object:

```typescript
{
  id: string;              // The ticket ID
  tx_id: string;           // The blockchain transaction ID
  tx_hex: string;          // The raw transaction hex
  action_requested: 'transfer';  // The requested action
  status: 'BROADCASTING' | 'SUCCESS' | 'MINED' | 'FAILED';
  createdAt: string;       // ISO timestamp when ticket was created
  updatedAt: string;       // ISO timestamp of last update
  errors: string | null;   // Error details if status is FAILED
}
```

## Status Values

- **BROADCASTING**: Transaction is being broadcast to the network
- **SUCCESS**: Transaction successfully broadcast and accepted by the network
- **MINED**: Transaction has been confirmed in a block
- **FAILED**: Transaction failed (check `errors` field for details)

## Common Use Cases

### After Transfer

```typescript
async function transferAndWait(recipients, wif) {
  // Initiate transfer
  const response = await mnee.transfer(recipients, wif);
  console.log('Transfer initiated:', response.ticketId);
  
  // Wait for confirmation
  let status;
  do {
    status = await mnee.getTxStatus(response.ticketId);
    console.log('Current status:', status.status);
    
    if (status.status === 'FAILED') {
      throw new Error(`Transfer failed: ${status.errors}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  } while (status.status === 'BROADCASTING');
  
  console.log('Transaction ID:', status.tx_id);
  return status.tx_id;
}
```

### With Timeout and Retry

```typescript
async function getTxWithRetry(ticketId, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const status = await mnee.getTxStatus(ticketId);
      return status;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
}
```

### Batch Status Checking

```typescript
async function checkMultipleTransactions(ticketIds) {
  const results = await Promise.allSettled(
    ticketIds.map(id => mnee.getTxStatus(id))
  );
  
  const statuses = results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return {
        ticketId: ticketIds[index],
        status: result.value.status,
        txId: result.value.tx_id,
        errors: result.value.errors
      };
    } else {
      return {
        ticketId: ticketIds[index],
        status: 'ERROR',
        error: result.reason.message
      };
    }
  });
  
  // Group by status
  const grouped = {
    broadcasting: statuses.filter(s => s.status === 'BROADCASTING'),
    success: statuses.filter(s => s.status === 'SUCCESS'),
    mined: statuses.filter(s => s.status === 'MINED'),
    failed: statuses.filter(s => s.status === 'FAILED'),
    error: statuses.filter(s => s.status === 'ERROR')
  };
  
  console.log('Status summary:', {
    broadcasting: grouped.broadcasting.length,
    success: grouped.success.length,
    mined: grouped.mined.length,
    failed: grouped.failed.length,
    error: grouped.error.length
  });
  
  return grouped;
}
```

### Transaction Monitor

```typescript
class TransactionMonitor {
  constructor(mnee) {
    this.mnee = mnee;
    this.monitoring = new Map();
  }
  
  async monitor(ticketId, callback, intervalMs = 2000) {
    if (this.monitoring.has(ticketId)) {
      console.log('Already monitoring:', ticketId);
      return;
    }
    
    const interval = setInterval(async () => {
      try {
        const status = await this.mnee.getTxStatus(ticketId);
        
        // Notify callback of status change
        callback(ticketId, status);
        
        // Stop monitoring if transaction is complete
        if (['SUCCESS', 'MINED', 'FAILED'].includes(status.status)) {
          this.stop(ticketId);
        }
      } catch (error) {
        console.error(`Error checking ${ticketId}:`, error);
        callback(ticketId, { status: 'ERROR', error: error.message });
        this.stop(ticketId);
      }
    }, intervalMs);
    
    this.monitoring.set(ticketId, interval);
  }
  
  stop(ticketId) {
    const interval = this.monitoring.get(ticketId);
    if (interval) {
      clearInterval(interval);
      this.monitoring.delete(ticketId);
      console.log('Stopped monitoring:', ticketId);
    }
  }
  
  stopAll() {
    for (const [ticketId, interval] of this.monitoring) {
      clearInterval(interval);
    }
    this.monitoring.clear();
    console.log('Stopped all monitoring');
  }
}

// Usage
const monitor = new TransactionMonitor(mnee);

monitor.monitor(ticketId, (id, status) => {
  console.log(`${id}: ${status.status}`);
  if (status.status === 'SUCCESS') {
    console.log('Transaction successful!', status.tx_id);
  }
});
```

## Error Handling

```typescript
try {
  const status = await mnee.getTxStatus(ticketId);
  
  if (status.status === 'FAILED') {
    // Handle based on error type
    if (status.errors?.includes('Insufficient')) {
      console.error('Not enough funds');
    } else if (status.errors?.includes('Invalid')) {
      console.error('Invalid transaction');
    } else {
      console.error('Transaction failed:', status.errors);
    }
  }
} catch (error) {
  if (error.message === 'Invalid API key') {
    console.error('API authentication failed');
  } else if (error.message.includes('Ticket not found')) {
    console.error('Invalid ticket ID');
  } else {
    console.error('Failed to get status:', error.message);
  }
}
```

## Important Notes

- The `tx_id` field will be empty until the transaction reaches SUCCESS status
- Tickets expire after a certain period - check status promptly after submission
- Status changes are one-way: BROADCASTING → SUCCESS → MINED (or → FAILED)
- Once a status reaches SUCCESS, MINED, or FAILED, it will not change
- For real-time updates without polling, use webhook callbacks when submitting transactions

## See Also

- [Transfer](./transfer.md) - Create and broadcast transactions
- [Transfer Multi](./transferMulti.md) - Advanced transfers with multiple inputs
- [Submit Raw Transaction](./submitRawTx.md) - Submit pre-signed transactions
- [Transfer Webhooks](./transferWebhook.md) - Real-time status updates via webhooks