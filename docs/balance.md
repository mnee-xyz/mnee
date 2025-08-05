# Check Balance

The `balance` method retrieves the balance for a specific MNEE address. This method is useful for checking how many MNEE tokens are associated with a given address.

## Usage

```typescript
const address = '1G6CB3Ch4zFkPmuhZzEyChQmrQPfi86qk3';

mnee.balance(address).then(balance => {
  console.log('Your balance:', balance);
});
```

## Response

The method returns a Promise that resolves to a `MNEEBalance` object, which includes the address and the amount of MNEE tokens.

### Sample Response

```json
{
  "address": "1G6CB3Ch4zFkPmuhZzEyChQmrQPfi86qk3",
  "amount": 461163,
  "decimalAmount": 4.61163
}
```

# Check Balances

The `balances` method retrieves the balances for multiple MNEE addresses in a single call. This is useful for checking the balances of several addresses at once.

## Usage

```typescript
const addresses = ['1G6CB3Ch4zFkPmuhZzEyChQmrQPfi86qk3', '1BFaJwJz5KPYGe28afDkGswbuKK6uK8hzQ'];

mnee.balances(addresses).then(balances => {
  console.log('Balances:', balances);
});
```

## Response

The method returns a Promise that resolves to an array of `MNEEBalance` objects, each containing the address and the amount of MNEE tokens.

### Sample Response

```json
[
  {
    "address": "1G6CB3Ch4zFkPmuhZzEyChQmrQPfi86qk3",
    "amount": 461163,
    "decimalAmount": 4.61163
  },
  {
    "address": "1BFaJwJz5KPYGe28afDkGswbuKK6uK8hzQ",
    "amount": 1500,
    "decimalAmount": 0.015
  }
]
```

## Balance Properties

- **address**: The Bitcoin address that was queried
- **amount**: The balance in atomic units (100,000 atomic units = 1 MNEE)
- **decimalAmount**: The balance in MNEE (human-readable format with decimals)

## Common Use Cases

### Single Address - Display User Balance

```typescript
const balance = await mnee.balance(userAddress);
console.log(`You have ${balance.decimalAmount} MNEE`);
```

### Single Address - Check Sufficient Funds

```typescript
const requiredAmount = 10; // 10 MNEE
const balance = await mnee.balance(address);

if (balance.decimalAmount >= requiredAmount) {
  console.log('Sufficient funds available');
} else {
  console.log(`Insufficient funds. Need ${requiredAmount - balance.decimalAmount} more MNEE`);
}
```

### Multiple Addresses - Calculate Total Balance

```typescript
const addresses = ['address1', 'address2', 'address3'];
const balances = await mnee.balances(addresses);

const totalBalance = balances.reduce((sum, balance) => sum + balance.decimalAmount, 0);
console.log(`Total balance across all addresses: ${totalBalance} MNEE`);
```

### Multiple Addresses - Find Funded Addresses

```typescript
const balances = await mnee.balances(addresses);
const fundedAddresses = balances.filter(balance => balance.decimalAmount > 0);

console.log('Addresses with funds:');
fundedAddresses.forEach(balance => {
  console.log(`${balance.address}: ${balance.decimalAmount} MNEE`);
});
```

### HD Wallet Balance Check

```typescript
// Generate HD wallet addresses
const hdAddresses = [];
for (let i = 0; i < 20; i++) {
  hdAddresses.push(hdWallet.deriveAddress(i, false).address);
}

// Check all addresses at once
const balances = await mnee.balances(hdAddresses);
const totalHDBalance = balances.reduce((sum, b) => sum + b.decimalAmount, 0);
console.log(`HD Wallet total: ${totalHDBalance} MNEE`);
```

### Monitor Balance Changes

```typescript
async function monitorBalance(address, intervalMs = 10000) {
  let previousBalance = 0;
  
  setInterval(async () => {
    const balance = await mnee.balance(address);
    if (balance.decimalAmount !== previousBalance) {
      console.log(`Balance changed: ${previousBalance} → ${balance.decimalAmount} MNEE`);
      previousBalance = balance.decimalAmount;
    }
  }, intervalMs);
}
```

## Performance Considerations

- Use `balance()` for single address queries
- Use `balances()` when checking 2 or more addresses (more efficient than multiple `balance()` calls)
- For very large sets of addresses (100+), consider using batch operations

## Notes

- The balance is calculated from all UTXOs owned by the address
- Both `amount` and `decimalAmount` represent the same value in different units
- Empty or invalid addresses will return a balance of 0
- The order of returned balances matches the order of input addresses

## See Also

- [Get UTXOs](./getUtxos.md) - Get detailed UTXO information
- [Unit Conversion](./unitConversion.md) - Convert between atomic units and MNEE
- [Batch Operations](./batch.md) - Process hundreds of addresses efficiently