# Get All UTXOs

The `getAllUtxos` method retrieves all Unspent Transaction Outputs (UTXOs) for a MNEE address. This method fetches every UTXO associated with the address by automatically paginating through all available results, making it ideal for comprehensive balance calculations and wallet management operations.

## Usage

### Basic Usage

```typescript
const address = '1G6CB3Ch4zFkPmuhZzEyChQmrQPfi86qk3';

try {
  const utxos = await mnee.getAllUtxos(address);
  console.log('All UTXOs:', utxos);
  console.log('Total UTXOs found:', utxos.length);

  // Calculate total balance
  const totalBalance = utxos.reduce((sum, utxo) => sum + utxo.data.bsv21.amt, 0);
  console.log('Total balance (atomic):', totalBalance);
  console.log('Total balance (MNEE):', mnee.fromAtomicAmount(totalBalance));
} catch (error) {
  console.error('Error fetching UTXOs:', error.message);
}
```

## Parameters

| Parameter | Type     | Required | Description                         |
| --------- | -------- | -------- | ----------------------------------- |
| `address` | `string` | Yes      | The MNEE address to fetch UTXOs for |

## Response

The method returns a Promise that resolves to an array of `MNEEUtxo` objects containing all UTXOs for the specified address.

### MNEEUtxo Structure

```typescript
type MNEEUtxo = {
  data: {
    bsv21: {
      amt: number; // Amount in atomic units
      dec: number; // Decimal places
      icon: string; // Token icon
      id: string; // Token ID
      op: string; // Operation type
      sym: string; // Token symbol
    };
    cosign: {
      address: string; // Cosigner address
      cosigner: string; // Cosigner identifier
    };
  };
  height: number; // Block height
  idx: number; // Transaction index
  outpoint: string; // Transaction outpoint (txid_vout)
  satoshis: number; // Satoshi amount
  script: string; // Script hex
  txid: string; // Transaction ID
  vout: number; // Output index
};
```

## Error Handling

The method handles various error scenarios gracefully:

```typescript
try {
  const utxos = await mnee.getAllUtxos(address);
  if (utxos.length === 0) {
    console.log('No UTXOs found for this address');
  }
} catch (error) {
  console.error('Error:', error.message);
  // Common errors: Invalid address, network issues, API key problems
}
```

## Performance Considerations

- **Complete Fetch**: Retrieves ALL UTXOs for the address, which may take longer for addresses with many UTXOs
- **Automatic Pagination**: Uses 100 UTXOs per page and automatically continues until all are fetched
- **Memory Usage**: Stores all UTXOs in memory - consider using `getUtxos` with pagination for very large UTXO sets
- **Network Intensive**: Makes multiple API calls for addresses with many UTXOs

## Use Cases

1. **Complete Balance Calculation**: Get exact total balance including all small UTXOs
2. **Wallet Display**: Show all available UTXOs in a wallet interface
3. **UTXO Management**: Analyze UTXO distribution and consolidation needs
4. **Audit Operations**: Verify all tokens associated with an address
5. **Advanced Transfer Planning**: Select optimal UTXOs for complex transactions

## Comparison with Related Methods

| Method           | Purpose               | Performance           | Use Case                |
| ---------------- | --------------------- | --------------------- | ----------------------- |
| `getAllUtxos`    | Fetch ALL UTXOs       | Slower for large sets | Complete wallet view    |
| `getEnoughUtxos` | Fetch just enough     | Faster for transfers  | Pre-transfer validation |
| `getUtxos`       | Fetch with pagination | Most flexible         | Custom pagination needs |

## Examples

### Calculate Complete Balance

```typescript
async function getCompleteBalance(address: string) {
  try {
    const utxos = await mnee.getAllUtxos(address);

    const totalAtomic = utxos.reduce((sum, utxo) => sum + utxo.data.bsv21.amt, 0);
    const totalMnee = mnee.fromAtomicAmount(totalAtomic);

    return {
      address,
      totalUtxos: utxos.length,
      totalBalance: totalMnee,
      utxos,
    };
  } catch (error) {
    return {
      address,
      error: error.message,
      totalUtxos: 0,
      totalBalance: 0,
      utxos: [],
    };
  }
}
```

### UTXO Analysis

```typescript
async function analyzeUtxos(address: string) {
  const utxos = await mnee.getAllUtxos(address);

  if (utxos.length === 0) {
    return { message: 'No UTXOs found' };
  }

  const amounts = utxos.map((utxo) => utxo.data.bsv21.amt);
  const totalBalance = amounts.reduce((sum, amt) => sum + amt, 0);
  const averageUtxo = totalBalance / utxos.length;
  const smallestUtxo = Math.min(...amounts);
  const largestUtxo = Math.max(...amounts);

  return {
    totalUtxos: utxos.length,
    totalBalance: mnee.fromAtomicAmount(totalBalance),
    averageUtxo: mnee.fromAtomicAmount(averageUtxo),
    smallestUtxo: mnee.fromAtomicAmount(smallestUtxo),
    largestUtxo: mnee.fromAtomicAmount(largestUtxo),
    consolidationNeeded: utxos.length > 100, // Suggest consolidation for many small UTXOs
  };
}
```

### Find Specific UTXOs

```typescript
async function findLargeUtxos(address: string, minimumAmount: number) {
  const utxos = await mnee.getAllUtxos(address);
  const atomicMinimum = mnee.toAtomicAmount(minimumAmount);

  const largeUtxos = utxos.filter((utxo) => utxo.data.bsv21.amt >= atomicMinimum);

  return {
    found: largeUtxos.length,
    utxos: largeUtxos,
    totalValue: mnee.fromAtomicAmount(largeUtxos.reduce((sum, utxo) => sum + utxo.data.bsv21.amt, 0)),
  };
}
```

## Related Methods

- [`getEnoughUtxos`](./getEnoughUtxos.md) - Get just enough UTXOs for a specific amount
- [`getUtxos`](./getUtxos.md) - Get UTXOs with pagination control
- [`balance`](./balance.md) - Get total balance without UTXO details
- [`toAtomicAmount`](./unitConversion.md) - Convert MNEE to atomic units
- [`fromAtomicAmount`](./unitConversion.md) - Convert atomic units to MNEE

## Best Practices

1. **Use for complete analysis** - Best when you need all UTXOs for comprehensive operations
2. **Consider pagination** - For addresses with many UTXOs, consider using `getUtxos` with pagination
3. **Cache results** - Store results temporarily to avoid repeated API calls for the same address
4. **Monitor performance** - Be aware that this method can be slow for addresses with hundreds of UTXOs
5. **Validate addresses** - Always validate the address format before calling
6. **Handle empty results** - Check for empty arrays when an address has no UTXOs

## When NOT to Use

- **Simple balance checks** - Use `balance` method instead
- **Transfer preparation** - Use `getEnoughUtxos` for better performance
- **Large UTXO sets** - Consider `getUtxos` with pagination for better memory management
- **Real-time operations** - May be too slow for time-sensitive operations

## Performance Tips

```typescript
// Good: Use when you need complete UTXO analysis
const allUtxos = await mnee.getAllUtxos(address);
const analysis = analyzeUtxoDistribution(allUtxos);

// Better: Use getEnoughUtxos for transfers
const transferUtxos = await mnee.getEnoughUtxos(address, requiredAmount);

// Best: Use balance for simple balance checks
const balance = await mnee.getBalance(address);
```
