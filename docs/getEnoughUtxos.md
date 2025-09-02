# Get Enough UTXOs

The `getEnoughUtxos` method retrieves just enough Unspent Transaction Outputs (UTXOs) for a MNEE address to cover a specified token amount. This method is optimized for transfer operations, as it stops fetching UTXOs once the required amount is reached, making it more efficient than fetching all UTXOs.

## Usage

### Basic Usage

```typescript
const address = '1G6CB3Ch4zFkPmuhZzEyChQmrQPfi86qk3';
const requiredAmount = 500000; // 5.00000 MNEE in atomic units

try {
  const utxos = await mnee.getEnoughUtxos(address, requiredAmount);
  console.log('UTXOs for transfer:', utxos);
  console.log('Number of UTXOs needed:', utxos.length);
} catch (error) {
  console.error('Insufficient balance:', error.message);
}
```

## Parameters

| Parameter                | Type     | Required | Description                                                         |
| ------------------------ | -------- | -------- | ------------------------------------------------------------------- |
| `address`                | `string` | Yes      | The MNEE address to fetch UTXOs for                                 |
| `totalAtomicTokenAmount` | `number` | Yes      | The required amount in atomic units (1 MNEE = 100,000 atomic units) |

## Response

The method returns a Promise that resolves to an array of `MNEEUtxo` objects containing just enough UTXOs to meet or exceed the required amount.

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

The method throws an error if there are insufficient MNEE tokens in the address to meet the required amount:

```typescript
try {
  const utxos = await mnee.getEnoughUtxos(address, 1000000);
} catch (error) {
  // Error message format: "Insufficient MNEE balance. Max transfer amount: X.XXXXX"
  console.error(error.message);
}
```

## Performance Considerations

- **Efficient**: Only fetches UTXOs until the required amount is reached
- **Pagination**: Uses 25 UTXOs per page to balance API efficiency and memory usage
- **Early Exit**: Stops immediately when sufficient UTXOs are found
- **No Sorting**: UTXOs are returned in the order they're fetched (newest first by default)

## Use Cases

1. **Pre-transfer Validation**: Check if an address has enough tokens before attempting a transfer
2. **UTXO Selection**: Get the exact UTXOs needed for a specific transaction amount
3. **Balance Verification**: Verify sufficient funds while minimizing API calls
4. **Wallet Operations**: Prepare UTXOs for transaction construction

## Related Methods

- [`getUtxos`](./getUtxos.md) - Get all UTXOs for an address with pagination
- [`balance`](./balance.md) - Get the total balance for an address
- [`transfer`](./transfer.md) - Transfer MNEE tokens (uses this method internally)
- [`toAtomicAmount`](./unitConversion.md) - Convert MNEE to atomic units
- [`fromAtomicAmount`](./unitConversion.md) - Convert atomic units to MNEE

## Best Practices

1. **Always handle errors** when calling this method, as insufficient balance is a common scenario
2. **Use atomic units** for precise calculations to avoid floating-point errors
3. **Consider the total amount** in returned UTXOs may exceed the requested amount (due to UTXO indivisibility)
4. **Cache results temporarily** if making multiple calls with the same parameters
5. **Validate addresses** before calling to avoid unnecessary API requests
