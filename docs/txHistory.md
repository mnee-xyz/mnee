# Transaction History

The MNEE SDK provides methods to retrieve transaction history for addresses, with support for pagination and batch queries.

## Recent Transaction History

The `recentTxHistory` method retrieves the transaction history for a single address.

### Usage

```typescript
const history = await mnee.recentTxHistory('your-address-here');
console.log('History:', history);
```

### With Pagination

```typescript
// Get first page (most recent transactions)
const firstPage = await mnee.recentTxHistory(address, undefined, 10);

// Get next page using nextScore
const secondPage = await mnee.recentTxHistory(
  address, 
  firstPage.nextScore, 
  10
);
```

### Parameters

- **address**: The Bitcoin address to query
- **fromScore** (optional): Starting score for pagination
- **limit** (optional): Maximum number of transactions to return

### Response

Returns a `TxHistoryResponse` object:

```typescript
{
  address: string;
  history: TxHistory[];
  nextScore: number;
}
```

### Sample Response

```json
{
  "address": "1G6CB3Ch4zFkPmuhZzEyChQmrQPfi86qk3",
  "history": [
    {
      "txid": "d7fe19af19332d8ab1d83ed82003ecc41c8c5def8e786b58e90512e82087302a",
      "height": 857421,
      "status": "confirmed",
      "type": "receive",
      "amount": 5000,
      "counterparties": [
        {
          "address": "1Sender...",
          "amount": 5000
        }
      ],
      "fee": 100,
      "score": 857421.00001
    },
    {
      "txid": "abc123...",
      "height": 857420,
      "status": "confirmed",
      "type": "send",
      "amount": 2500,
      "counterparties": [
        {
          "address": "1Recipient...",
          "amount": 2500
        }
      ],
      "fee": 100,
      "score": 857420.00002
    }
  ],
  "nextScore": 857419.00003
}
```

## Recent Transaction Histories (Batch)

The `recentTxHistories` method retrieves transaction histories for multiple addresses in a single call.

### Usage

```typescript
const params = [
  { address: 'address1' },
  { address: 'address2', fromScore: 0, limit: 10 }
];

const histories = await mnee.recentTxHistories(params);
console.log('Histories:', histories);
```

### Parameters

Array of `AddressHistoryParams`, each containing:
- **address**: The Bitcoin address
- **fromScore** (optional): Starting score for pagination
- **limit** (optional): Maximum transactions per address

### Response

Returns an array of `TxHistoryResponse` objects, one for each address.

## Transaction History Properties

### TxHistory Object

- **txid**: Transaction identifier
- **height**: Block height (0 for unconfirmed)
- **status**: `"confirmed"` or `"unconfirmed"`
- **type**: `"send"` or `"receive"`
- **amount**: Amount in atomic units
- **counterparties**: Array of addresses and amounts involved
- **fee**: Transaction fee in atomic units
- **score**: Sortable score for pagination

### Counterparty Object

- **address**: The counterparty's address
- **amount**: Amount sent to/from this address

## Common Use Cases

### Display Transaction List

```typescript
async function displayTransactions(address) {
  const history = await mnee.recentTxHistory(address, undefined, 20);
  
  console.log(`Transaction History for ${address}:`);
  history.history.forEach(tx => {
    const amount = mnee.fromAtomicAmount(tx.amount);
    const symbol = tx.type === 'receive' ? '+' : '-';
    const status = tx.status === 'confirmed' ? '✓' : '⏳';
    
    console.log(`${status} ${symbol}${amount} MNEE - ${tx.txid.substring(0, 8)}...`);
    
    tx.counterparties.forEach(cp => {
      console.log(`    ${tx.type === 'receive' ? 'from' : 'to'}: ${cp.address}`);
    });
  });
}
```

### Calculate Total Received

```typescript
async function calculateTotalReceived(address) {
  let totalReceived = 0;
  let nextScore = undefined;
  
  // Paginate through all history
  while (true) {
    const history = await mnee.recentTxHistory(address, nextScore, 100);
    
    // Sum received amounts
    const pageReceived = history.history
      .filter(tx => tx.type === 'receive' && tx.status === 'confirmed')
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    totalReceived += pageReceived;
    
    // Check if more pages exist
    if (history.history.length < 100 || !history.nextScore) {
      break;
    }
    
    nextScore = history.nextScore;
  }
  
  return mnee.fromAtomicAmount(totalReceived);
}
```

### Monitor for New Transactions

```typescript
async function monitorAddress(address, callback) {
  let lastTxid = null;
  
  setInterval(async () => {
    const history = await mnee.recentTxHistory(address, undefined, 1);
    
    if (history.history.length > 0) {
      const latestTx = history.history[0];
      
      if (latestTx.txid !== lastTxid) {
        lastTxid = latestTx.txid;
        callback(latestTx);
      }
    }
  }, 30000); // Check every 30 seconds
}

// Usage
monitorAddress('your-address', (tx) => {
  const amount = mnee.fromAtomicAmount(tx.amount);
  console.log(`New ${tx.type}: ${amount} MNEE`);
});
```

### Multi-Address Portfolio History

```typescript
async function getPortfolioHistory(addresses) {
  const params = addresses.map(addr => ({
    address: addr,
    limit: 10 // Recent 10 transactions per address
  }));
  
  const histories = await mnee.recentTxHistories(params);
  
  // Combine and sort all transactions
  const allTransactions = histories.flatMap(h => 
    h.history.map(tx => ({ ...tx, address: h.address }))
  );
  
  // Sort by score (most recent first)
  allTransactions.sort((a, b) => b.score - a.score);
  
  return allTransactions;
}
```

### Export Transaction History

```typescript
async function exportToCSV(address) {
  const rows = ['Date,Type,Amount,Counterparty,TxID,Status'];
  let nextScore = undefined;
  
  while (true) {
    const history = await mnee.recentTxHistory(address, nextScore, 100);
    
    history.history.forEach(tx => {
      const date = new Date(tx.height * 600000).toISOString(); // Estimate
      const amount = mnee.fromAtomicAmount(tx.amount);
      const counterparty = tx.counterparties[0]?.address || 'Unknown';
      
      rows.push(
        `${date},${tx.type},${amount},${counterparty},${tx.txid},${tx.status}`
      );
    });
    
    if (history.history.length < 100) break;
    nextScore = history.nextScore;
  }
  
  return rows.join('\n');
}
```

### Find Transactions with Specific Address

```typescript
async function findTransactionsWith(myAddress, targetAddress) {
  const matching = [];
  let nextScore = undefined;
  
  while (true) {
    const history = await mnee.recentTxHistory(myAddress, nextScore, 100);
    
    const matches = history.history.filter(tx =>
      tx.counterparties.some(cp => cp.address === targetAddress)
    );
    
    matching.push(...matches);
    
    if (history.history.length < 100) break;
    nextScore = history.nextScore;
  }
  
  return matching;
}
```

## Pagination Best Practices

- Start with `fromScore: undefined` for the most recent transactions
- Use the returned `nextScore` to fetch the next page
- When `history.length < limit`, you've reached the end
- Store `nextScore` to resume pagination later
- Higher scores represent more recent transactions

## Performance Tips

- Use `recentTxHistories` for multiple addresses instead of multiple `recentTxHistory` calls
- Limit page size based on your UI needs (10-50 for display, 100+ for analysis)
- Cache results when appropriate
- For large-scale analysis, consider using batch operations

## See Also

- [Parse Transaction](./parseTx.md) - Get detailed transaction information
- [Balance](./balance.md) - Get current balance
- [Batch Operations](./batch.md) - Process history for many addresses