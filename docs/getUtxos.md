# Get UTXOs

The `getUtxos` method retrieves the Unspent Transaction Outputs (UTXOs) for one or more MNEE addresses. UTXOs represent the spendable MNEE tokens associated with an address and are essential for constructing new transactions.

## Usage

### Basic Usage

```typescript
const address = '1G6CB3Ch4zFkPmuhZzEyChQmrQPfi86qk3';

// Returns up to 10 UTXOs by default
const utxos = await mnee.getUtxos(address);
console.log('UTXOs:', utxos);
```

### With Pagination

```typescript
const address = '1G6CB3Ch4zFkPmuhZzEyChQmrQPfi86qk3';

// Get first page with 20 UTXOs
const page1 = await mnee.getUtxos(address, 0, 20);
console.log('First 20 UTXOs:', page1);

// Get second page
const page2 = await mnee.getUtxos(address, 1, 20);
console.log('Next 20 UTXOs:', page2);

// Get UTXOs in ascending order (oldest first)
const ascUtxos = await mnee.getUtxos(address, 0, 50, 'asc');
console.log('Oldest UTXOs first:', ascUtxos);
```

### Multiple Addresses

```typescript
const addresses = ['1G6CB3Ch4zFkPmuhZzEyChQmrQPfi86qk3', '1BFaJwJz5KPYGe28afDkGswbuKK6uK8hzQ'];

// Returns up to 10 UTXOs by default
const utxos = await mnee.getUtxos(addresses);
console.log('UTXOs from all addresses:', utxos);

// Get more UTXOs by specifying size
const moreUtxos = await mnee.getUtxos(addresses, 0, 100, 'desc');
console.log('First 100 UTXOs (newest first):', moreUtxos);
```

## Parameters

- **address**: Single Bitcoin address or array of addresses
- **page** (optional): Page number starting from 0
- **size** (optional): Number of UTXOs per page (default: 10)
- **order** (optional): Sort order - 'asc' for oldest first, 'desc' for newest first (default: 'desc')

## Response

The method returns a Promise that resolves to an array of `MNEEUtxo` objects. Each UTXO contains detailed information about the MNEE tokens, including BSV21 protocol data and cosigner information.

### Sample Response

```json
[
  {
    "data": {
      "bsv21": {
        "amt": 95799,
        "dec": 5,
        "icon": "1FGEBTUu7EqWWK5DKrG6pxjEGLahpATnA8",
        "id": "ae59f3b898ec61acbdb6cc7a245fabeded0c094bf046f35206a3aec60ef88127_0",
        "op": "transfer",
        "sym": "MNEE"
      },
      "cosign": {
        "address": "17cgGUmStWwcYgHg3kxmzXSp6JUbj8XA3u",
        "cosigner": "03d47c2e48c59b3f58b96c9e616d0a84c6e02725e47beefcb5b5a8fbe21a3c5e3a"
      }
    },
    "height": 857421,
    "idx": 0,
    "outpoint": "d7fe19af19332d8ab1d83ed82003ecc41c8c5def8e786b58e90512e82087302a:0",
    "owners": ["1G6CB3Ch4zFkPmuhZzEyChQmrQPfi86qk3"],
    "satoshis": 1000,
    "score": 857421.00001
  },
  {
    "data": {
      "bsv21": {
        "amt": 50000,
        "dec": 5,
        "icon": "1FGEBTUu7EqWWK5DKrG6pxjEGLahpATnA8",
        "id": "ae59f3b898ec61acbdb6cc7a245fabeded0c094bf046f35206a3aec60ef88127_0",
        "op": "transfer",
        "sym": "MNEE"
      },
      "cosign": {
        "address": "1PqgNQwyPbc1Ue8QwEDFJUP2monKv9hSo4",
        "cosigner": "03d47c2e48c59b3f58b96c9e616d0a84c6e02725e47beefcb5b5a8fbe21a3c5e3a"
      }
    },
    "height": 857420,
    "idx": 1,
    "outpoint": "a9b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef:1",
    "owners": ["1G6CB3Ch4zFkPmuhZzEyChQmrQPfi86qk3"],
    "satoshis": 1000,
    "score": 857420.00002
  }
]
```

## UTXO Properties

### Main Properties

- **outpoint**: The full UTXO identifier in format `txid:vout`
- **height**: The block height when this UTXO was created
- **idx**: The output index within the transaction
- **owners**: Array of addresses that can spend this UTXO
- **satoshis**: The BSV satoshis in this output (not MNEE amount)
- **score**: A sortable score based on height and index

### BSV21 Data (`data.bsv21`)

- **amt**: The amount of MNEE tokens in atomic units (100,000 = 1 MNEE)
- **dec**: Number of decimal places (5 for MNEE)
- **icon**: The icon address for the token
- **id**: The token ID
- **op**: The operation type (typically "transfer")
- **sym**: The token symbol ("MNEE")

### Cosigner Data (`data.cosign`)

- **address**: The cosigner address for this UTXO
- **cosigner**: The cosigner public key

## Common Use Cases

### Calculate Total Spendable Balance

```typescript
// WARNING: Default only returns 10 UTXOs - may not be complete balance!
// Specify a larger size or use pagination for accurate balance
const utxos = await mnee.getUtxos(address, 0, 1000); // Get up to 1000 UTXOs
const totalAtomicUnits = utxos.reduce((sum, utxo) => sum + utxo.data.bsv21.amt, 0);
const totalMNEE = mnee.fromAtomicAmount(totalAtomicUnits);
console.log(`Total spendable: ${totalMNEE} MNEE`);

// For accurate balance, consider using the balance() method instead:
const balance = await mnee.balance(address);
console.log(`Total balance: ${balance.decimalAmount} MNEE`);
```

### Get All UTXOs with Pagination

```typescript
async function getAllUtxosWithPagination(address) {
  const allUtxos = [];
  const pageSize = 100;
  let page = 0;

  while (true) {
    const utxos = await mnee.getUtxos(address, page, pageSize);
    allUtxos.push(...utxos);

    console.log(`Retrieved page ${page + 1}: ${utxos.length} UTXOs`);

    // If we got less than pageSize, we've reached the end
    if (utxos.length < pageSize) break;

    page++;
  }

  console.log(`Total UTXOs retrieved: ${allUtxos.length}`);
  return allUtxos;
}
```

### Find UTXOs Above a Certain Amount

```typescript
const utxos = await mnee.getUtxos(address);
const largeUtxos = utxos.filter((utxo) => utxo.data.bsv21.amt >= 10000); // 0.1 MNEE or more
console.log(`Found ${largeUtxos.length} UTXOs with 0.1 MNEE or more`);
```

### Prepare UTXOs for Multi-Source Transfer

```typescript
const addresses = ['address1', 'address2', 'address3'];
const allUtxos = await mnee.getUtxos(addresses);

// Group UTXOs by owner address for transferMulti
const utxosByAddress = allUtxos.reduce((acc, utxo) => {
  const owner = utxo.owners[0];
  if (!acc[owner]) acc[owner] = [];
  acc[owner].push(utxo);
  return acc;
}, {});

// Convert to transferMulti format
const inputs = allUtxos.map((utxo) => ({
  txid: utxo.outpoint.split(':')[0],
  vout: parseInt(utxo.outpoint.split(':')[1]),
  wif: 'private-key-for-owner', // You need to provide the WIF for each UTXO owner
}));
```

### Filter UTXOs by Operation Type

```typescript
const utxos = await mnee.getUtxos(address);
const transferUtxos = utxos.filter((utxo) => utxo.data.bsv21.op === 'transfer');
console.log(`Found ${transferUtxos.length} transfer UTXOs`);
```

## Performance Considerations

- The API returns only 10 UTXOs by default - specify a larger `size` parameter if you need more
- For addresses with many UTXOs, use pagination to retrieve all of them:

```typescript
// Get all UTXOs for an address
async function getAllUtxos(address) {
  const allUtxos = [];
  const pageSize = 100; // Balance between efficiency and memory
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const utxos = await mnee.getUtxos(address, page, pageSize);
    allUtxos.push(...utxos);
    hasMore = utxos.length === pageSize;
    page++;
  }

  return allUtxos;
}
```

## Important Notes

- **Default limit is 10 UTXOs** - Always specify the `size` parameter if you need more
- If an address has more UTXOs than your page size, use pagination to retrieve all of them
- For just checking balance, use the `balance()` method which is more efficient
- UTXOs are sorted by score (based on height and index) in descending order by default

## See Also

- [Balance](./balance.md) - Get balance without UTXO details (more efficient for balance checks)
- [Transfer Multi](./transferMulti.md) - Use UTXOs for multi-source transfers
