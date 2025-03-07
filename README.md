# MNEE TypeScript SDK

The MNEE TypeScript SDK provides a simple and efficient way to interact with the MNEE USD. It allows developers to perform operations such as retrieving configuration, checking balances, validating transactions, and transferring MNEE tokens programmatically.

## Features

- Retrieve MNEE service configuration
- Check the balance of an address
- Validate MNEE transactions
- Transfer MNEE tokens
- Convert amounts to atomic units for precise calculations

## Installation

To use this SDK in your project, install it via npm.

```bash
npm install mnee
```

## Usage

Here’s how you can get started with the Mnee SDK:

### Initialization

```typescript
import Mnee from 'mnee';

// Initialize with an optional API token
const mnee = new Mnee('your-api-token');
```

### Example: Checking a Balance

```typescript
async function checkBalance() {
  const address = 'your-address-here';
  const balance = await mnee.balance(address);
  console.log('Balance:', balance);
}

checkBalance();
```

### Example: Transferring MNEE Tokens

```typescript
async function transferTokens() {
  const request = [
    {
      to: 'recipient-1-address',
      amount: 2.55, // Amount in MNEE as a float
    },
    {
      to: 'recipient-2-address',
      amount: 5,
    },
  ];
  const wif = 'sender-wif-key';
  const response = await mnee.transfer(request, wif);
  console.log('Transfer Response:', response);
}

transferTokens();
```

### Example: Validating a Transaction (Server-Side)

```typescript
const rawtx = '0100000002b170f2d41764c...'; // a raw tx hex
const isValid = await mnee.validateMneeTx(rawtx);

// You can also do a deeper validation by ensureing addresses and amounts are properly paid
const isVaild = await mnee.validateMneeTx(rawtx, [
  {
    to: 'recipient-1-address',
    amount: 1,
  },
  {
    to: 'recipient-2-address',
    amount: 10.25,
  },
]);
```

### Example: Converting to Atomic Amount

```typescript
const atomic = mnee.toAtomicAmount(1.5);
console.log('Atomic Amount:', atomic); // Outputs: 150000
```

## Contributing

Contributions are welcome! Please submit a pull request or open an issue on the repository to suggest improvements or report bugs.

## License

This project is licensed under the MIT License. See the LICENSE file for details.
