# Validate Transaction

The `validateMneeTx` method validates MNEE transactions to ensure they are properly formatted and authorized by the cosigner. It supports both basic validation (checking if the transaction is well-formed) and deep validation (verifying against expected outputs).

## Usage

### Basic Validation

```typescript
const rawtx = '0100000002b170f2d41764c...'; // raw tx hex
const isValid = await mnee.validateMneeTx(rawtx);
console.log('Transaction is valid:', isValid);
```

### Deep Validation (with expected outputs)

```typescript
const rawtx = '0100000002b170f2d41764c...'; // raw tx hex
const expectedOutputs = [
  { address: 'recipient-1-address', amount: 1 },
  { address: 'recipient-2-address', amount: 10.25 },
];

const isValid = await mnee.validateMneeTx(rawtx, expectedOutputs);
console.log('Transaction matches expected outputs:', isValid);
```

## Parameters

- **rawTxHex**: The raw transaction hex string to validate
- **request** (optional): An array of `SendMNEE` objects representing the expected transfer details
  - If provided: Validates that the transaction matches the specified outputs
  - If not provided: Only validates that the transaction is well-formed with proper cosigner authorization

## Response

Returns a Promise that resolves to a boolean:
- `true`: The transaction is valid
- `false`: The transaction is invalid

## Common Use Cases

### Validate Before Broadcasting

```typescript
// Create a transaction
const transferRequest = [
  { address: '1Recipient...', amount: 5.5 }
];
const response = await mnee.transfer(transferRequest, wif, false); // broadcast: false

// Validate before submitting
const isValid = await mnee.validateMneeTx(response.rawtx);
if (isValid) {
  const submitResult = await mnee.submitRawTx(response.rawtx);
  console.log('Transaction submitted:', submitResult.txid);
} else {
  console.log('Transaction validation failed');
}
```

### Verify External Transactions

```typescript
// Receive a transaction from external source
const externalRawTx = '...'; // raw tx from another wallet/service

// Basic validation
const isWellFormed = await mnee.validateMneeTx(externalRawTx);
console.log('Transaction structure valid:', isWellFormed);

// Parse to see details
if (isWellFormed) {
  const parsed = await mnee.parseTxFromRawTx(externalRawTx);
  console.log('Transaction details:', parsed);
}
```

### Validate Multi-Recipient Transactions

```typescript
const expectedTransfers = [
  { address: '1Address1...', amount: 2.5 },
  { address: '1Address2...', amount: 7.3 },
  { address: '1Address3...', amount: 0.2 }
];

// Create transaction with multiple recipients
const response = await mnee.transfer(expectedTransfers, wif, false);

// Validate it matches our expectations
const isValid = await mnee.validateMneeTx(response.rawtx, expectedTransfers);
console.log('Multi-recipient transaction valid:', isValid);
```

### Integration Testing

```typescript
// Test transaction creation and validation
async function testTransactionCreation() {
  const testTransfer = [{ address: testAddress, amount: 0.001 }];
  
  try {
    // Create transaction
    const tx = await mnee.transfer(testTransfer, testWif, false);
    
    // Validate structure
    const basicValid = await mnee.validateMneeTx(tx.rawtx);
    assert(basicValid, 'Basic validation should pass');
    
    // Validate outputs
    const deepValid = await mnee.validateMneeTx(tx.rawtx, testTransfer);
    assert(deepValid, 'Deep validation should pass');
    
    console.log('Transaction validation tests passed');
  } catch (error) {
    console.error('Validation test failed:', error);
  }
}
```

## Validation Checks

The method performs the following validations:

### Basic Validation (always performed)
- Transaction hex is valid and can be decoded
- Transaction has proper MNEE inscription format
- Cosigner signature is present and valid
- Transaction structure follows MNEE protocol rules

### Deep Validation (when request provided)
- All specified recipients are present in outputs
- Transfer amounts match exactly (in atomic units)
- No unexpected outputs (except change and fees)
- Total output amounts are correct

## Notes

- Validation is performed locally without network calls
- The cosigner public key is obtained from the MNEE configuration
- Amount comparisons are done in atomic units to avoid floating-point issues
- Change outputs and fee outputs are automatically accounted for in deep validation

## See Also

- [Transfer](./transfer.md) - Create MNEE transfers
- [Submit Raw Transaction](./submitRawTx.md) - Submit validated transactions
- [Parse Transaction](./parseTx.md) - Examine transaction details