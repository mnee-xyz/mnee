# Check Balance

The `balance` method retrieves the balance for a specific MNEE address. This method is useful for checking how many MNEE tokens are associated with a given address.

## Usage

```typescript
const address = '0xdb03C44A8C63f2c2d057A252b35f4483F97Dd230';

mnee.balance(address).then(balance => {
  console.log('Your balance:', balance);
});
```

## Response

The method returns a Promise that resolves to a `MNEEBalance` object, which includes the address and the amount of MNEE tokens.

### Sample Response

```json
{
  "500"
}
```

# Check Balances

The `balances` method retrieves the balances for multiple MNEE addresses in a single call. This is useful for checking the balances of several addresses at once.

## Usage

```typescript
const addresses = ['0xdb03C44A8C63f2c2d057A252b35f4483F97Dd230', '0xdb03C44A8C63f2c2d057A252b35f448A4F7Dd230'];

mnee.balances(addresses).then(balances => {
  console.log('Balances:', balances);
});
```

## Response

The method returns a Promise that resolves to an array of `MNEEBalance` objects, each containing the address and the amount of MNEE tokens.

### Sample Response

```json
[
   "500",
   "1000"
]
```

## Common Use Cases

### Single Address - Display User Balance

```typescript
const balance = await mnee.balance(userAddress);
console.log(`You have ${balance} MNEE`);
```

### Single Address - Check Sufficient Funds

```typescript
const requiredAmount = 10; // 10 MNEE
const balance = await mnee.balance(address);

if (balance.amount >= requiredAmount) {
  console.log('Sufficient funds available');
} else {
  console.log(`Insufficient funds. Need ${requiredAmount - balance} more MNEE`);
}
```