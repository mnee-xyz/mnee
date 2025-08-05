# Get UTXOs

The `getUtxos` method retrieves the Unspent Transaction Outputs (UTXOs) for one or more MNEE addresses. UTXOs represent the spendable MNEE tokens associated with an address and are essential for constructing new transactions.

## Usage

### Single Address

```typescript
const address = '1G6CB3Ch4zFkPmuhZzEyChQmrQPfi86qk3';

mnee.getUtxos(address).then(utxos => {
  console.log('UTXOs:', utxos);
});
```

### Multiple Addresses

```typescript
const addresses = ['1G6CB3Ch4zFkPmuhZzEyChQmrQPfi86qk3', '1BFaJwJz5KPYGe28afDkGswbuKK6uK8hzQ'];

mnee.getUtxos(addresses).then(utxos => {
  console.log('All UTXOs:', utxos);
});
```

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
const utxos = await mnee.getUtxos(address);
const totalAtomicUnits = utxos.reduce((sum, utxo) => sum + utxo.data.bsv21.amt, 0);
const totalMNEE = mnee.fromAtomicAmount(totalAtomicUnits);
console.log(`Total spendable: ${totalMNEE} MNEE`);
```

### Find UTXOs Above a Certain Amount

```typescript
const utxos = await mnee.getUtxos(address);
const largeUtxos = utxos.filter(utxo => utxo.data.bsv21.amt >= 10000); // 0.1 MNEE or more
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
const inputs = allUtxos.map(utxo => ({
  txid: utxo.outpoint.split(':')[0],
  vout: parseInt(utxo.outpoint.split(':')[1]),
  wif: 'private-key-for-owner' // You need to provide the WIF for each UTXO owner
}));
```

### Filter UTXOs by Operation Type

```typescript
const utxos = await mnee.getUtxos(address);
const transferUtxos = utxos.filter(utxo => utxo.data.bsv21.op === 'transfer');
console.log(`Found ${transferUtxos.length} transfer UTXOs`);
```

## Performance Considerations

- For single addresses, this method is very efficient
- When querying multiple addresses, consider using batch operations for better performance:

```typescript
const batch = mnee.batch();
const result = await batch.getUtxos(addresses, {
  chunkSize: 20,
  continueOnError: true
});
```

## See Also

- [Balance](./balance.md) - Get balance without UTXO details
- [Transfer Multi](./transferMulti.md) - Use UTXOs for multi-source transfers
- [Batch Operations](./batch.md) - Process large numbers of addresses efficiently