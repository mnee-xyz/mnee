# Unit Conversion

MNEE uses atomic units for precise calculations and to avoid floating-point arithmetic errors. The SDK provides two methods for converting between human-readable MNEE amounts and atomic units.

## Conversion Methods

### toAtomicAmount

Converts a human-readable MNEE amount to atomic units.

```typescript
const atomic = mnee.toAtomicAmount(1.5);
console.log(atomic); // 150000
```

### fromAtomicAmount

Converts atomic units to human-readable MNEE amount.

```typescript
const human = mnee.fromAtomicAmount(150000);
console.log(human); // 1.5
```

## Understanding Units

- **1 MNEE = 100,000 atomic units**
- MNEE has 5 decimal places
- All blockchain operations use atomic units
- User interfaces should display MNEE amounts

## Common Use Cases

### Preparing Transfer Amounts

```typescript
// User wants to send 10.5 MNEE
const userAmount = 10.5;
const atomicAmount = mnee.toAtomicAmount(userAmount);

// Use atomic amount for internal calculations
console.log(`Sending ${atomicAmount} atomic units`);

// But show user-friendly amount
console.log(`Sending ${userAmount} MNEE`);
```

### Displaying Balances

```typescript
const balance = await mnee.balance(address);

// The balance object already includes both formats
console.log(`Atomic: ${balance.amount}`);        // 1234567
console.log(`MNEE: ${balance.decimalAmount}`);   // 12.34567

// Or convert manually
const mneeAmount = mnee.fromAtomicAmount(balance.amount);
console.log(`You have ${mneeAmount} MNEE`);
```

### Fee Calculations

```typescript
const config = await mnee.config();

// Find fee for a 50 MNEE transfer
const transferAtomic = mnee.toAtomicAmount(50);

const feeTier = config.fees.find(tier => 
  transferAtomic >= tier.min && transferAtomic <= tier.max
);

// Convert fee to MNEE for display
const feeMNEE = mnee.fromAtomicAmount(feeTier.fee);
console.log(`Transfer fee: ${feeMNEE} MNEE`);
```

### UTXO Amount Calculations

```typescript
const utxos = await mnee.getUtxos(address);

// Sum UTXO amounts (in atomic units)
const totalAtomic = utxos.reduce((sum, utxo) => 
  sum + utxo.data.bsv21.amt, 0
);

// Convert to MNEE for display
const totalMNEE = mnee.fromAtomicAmount(totalAtomic);
console.log(`Total in UTXOs: ${totalMNEE} MNEE`);
```

### Input Validation

```typescript
function validateAmount(userInput) {
  const amount = parseFloat(userInput);
  
  if (isNaN(amount) || amount <= 0) {
    throw new Error('Invalid amount');
  }
  
  // Check decimal places
  const atomic = mnee.toAtomicAmount(amount);
  const backToMnee = mnee.fromAtomicAmount(atomic);
  
  if (amount !== backToMnee) {
    throw new Error('Too many decimal places (max 5)');
  }
  
  // Check minimum (dust limit)
  const config = await mnee.config();
  if (atomic < config.fees[0].fee) {
    throw new Error(`Minimum amount is ${mnee.fromAtomicAmount(config.fees[0].fee)} MNEE`);
  }
  
  return amount;
}
```

### Precision Handling

```typescript
// Avoid floating point issues
const amount1 = 0.1;
const amount2 = 0.2;

// Wrong way (floating point error)
const wrongSum = amount1 + amount2; // 0.30000000000000004

// Right way (using atomic units)
const atomic1 = mnee.toAtomicAmount(amount1);
const atomic2 = mnee.toAtomicAmount(amount2);
const atomicSum = atomic1 + atomic2;
const correctSum = mnee.fromAtomicAmount(atomicSum); // 0.3
```

### Format for Display

```typescript
function formatMNEE(atomicAmount) {
  const mneeAmount = mnee.fromAtomicAmount(atomicAmount);
  
  // Format with appropriate decimal places
  if (mneeAmount >= 1) {
    return mneeAmount.toFixed(2); // "1.50"
  } else if (mneeAmount >= 0.01) {
    return mneeAmount.toFixed(3); // "0.015"
  } else {
    return mneeAmount.toFixed(5); // "0.00015"
  }
}
```

### Batch Amount Processing

```typescript
// Convert multiple amounts efficiently
const userAmounts = [1.5, 2.3, 0.45, 10];
const atomicAmounts = userAmounts.map(amt => mnee.toAtomicAmount(amt));

// Process in atomic units
const total = atomicAmounts.reduce((sum, amt) => sum + amt, 0);
const average = total / atomicAmounts.length;

// Convert back for display
console.log(`Total: ${mnee.fromAtomicAmount(total)} MNEE`);
console.log(`Average: ${mnee.fromAtomicAmount(average)} MNEE`);
```

## Important Notes

- Always use atomic units for calculations to avoid rounding errors
- MNEE amounts in the SDK methods (transfer, etc.) expect decimal MNEE values, not atomic
- Maximum precision is 5 decimal places
- When displaying to users, consider formatting appropriately
- Database storage should use atomic units (integers) for accuracy

## Conversion Table

| MNEE | Atomic Units |
|------|--------------|
| 0.00001 | 1 |
| 0.0001 | 10 |
| 0.001 | 100 |
| 0.01 | 1,000 |
| 0.1 | 10,000 |
| 1 | 100,000 |
| 10 | 1,000,000 |
| 100 | 10,000,000 |

## See Also

- [Configuration](./config.md) - Fee tiers use atomic units
- [Balance](./balance.md) - Returns both atomic and decimal amounts
- [Get UTXOs](./getUtxos.md) - UTXO amounts are in atomic units
- [Transfer](./transfer.md) - Accepts amounts in MNEE (decimal)