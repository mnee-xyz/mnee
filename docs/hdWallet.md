# HD Wallet

The MNEE SDK includes a complete BIP32/BIP44 hierarchical deterministic (HD) wallet implementation. This allows you to manage multiple addresses from a single mnemonic seed phrase, perfect for wallet applications and advanced key management.

## Setup

```typescript
import Mnee, { HDWallet } from 'mnee/ts-sdk';

// Initialize MNEE SDK
const mnee = new Mnee({ apiKey: 'your-api-key' });

// For examples below, assume these are already set up
```

## Static Methods

### Generate Mnemonic

Generate a new BIP39 mnemonic phrase (12 words).

```typescript
const mnemonic = HDWallet.generateMnemonic();
console.log('New mnemonic:', mnemonic);
// Output: "abandon abandon abandon ... about"
```

### Validate Mnemonic

Check if a mnemonic phrase is valid.

```typescript
const isValid = HDWallet.isValidMnemonic(mnemonic);
console.log('Mnemonic valid:', isValid);
```

## Creating an HD Wallet

```typescript
const mnemonic = 'your twelve word mnemonic phrase here ...';
const hdWallet = mnee.HDWallet(mnemonic, {
  derivationPath: "m/44'/236'/0'",
  cacheSize: 1000  // Optional: number of addresses to cache
});
```

### Parameters

- **mnemonic**: BIP39 mnemonic phrase (12-24 words)
- **options**: `HDWalletOptions` object
  - **derivationPath**: BIP44 derivation path (e.g., `"m/44'/236'/0'"`)
  - **cacheSize** (optional): Number of derived addresses to cache (default: 1000)

## Deriving Addresses

### Single Address

```typescript
// Derive external (receive) address at index 0
const addressInfo = hdWallet.deriveAddress(0, false);
console.log('Address:', addressInfo.address);
console.log('Private Key (WIF):', addressInfo.privateKey);
console.log('Derivation Path:', addressInfo.path);

// Derive change address at index 0
const changeInfo = hdWallet.deriveAddress(0, true);
```

### Multiple Addresses

```typescript
// Derive 10 receive addresses starting at index 0
const addresses = await hdWallet.deriveAddresses(0, 10, false);

addresses.forEach((info, i) => {
  console.log(`Address ${i}: ${info.address}`);
});

// Derive 5 change addresses starting at index 10
const changeAddresses = await hdWallet.deriveAddresses(10, 5, true);
```

### Response Structure

Each derived address returns an `AddressInfo` object:

```typescript
{
  address: string;      // Bitcoin address
  privateKey: string;   // Private key in WIF format
  path: string;         // Full derivation path
}
```

## Getting Private Keys for Addresses

Retrieve private keys for specific addresses by scanning the HD wallet.

```typescript
const addresses = [
  '1Address1...',
  '1Address2...',
  '1Address3...'
];

const result = hdWallet.getPrivateKeysForAddresses(addresses);
console.log('Private keys:', result.privateKeys);
console.log('Paths:', result.paths);
// result.privateKeys: {
//   '1Address1...': 'L1PrivateKey...',
//   '1Address2...': 'L2PrivateKey...',
//   '1Address3...': 'L3PrivateKey...'
// }
// result.paths: {
//   '1Address1...': "m/44'/236'/0'/0/0",
//   '1Address2...': "m/44'/236'/0'/0/1",
//   '1Address3...': "m/44'/236'/0'/1/0"
// }
```

### With Scan Options

```typescript
const result = hdWallet.getPrivateKeysForAddresses(addresses, {
  maxScanReceive: 10000,  // Max receive addresses to scan
  maxScanChange: 10000,   // Max change addresses to scan
  scanStrategy: 'parallel' // 'sequential' or 'parallel'
});
```

## Common Use Cases

### Create New Wallet

```typescript
function createNewWallet(mnee) {
  // Generate new mnemonic
  const mnemonic = HDWallet.generateMnemonic();
  
  // Create HD wallet
  const hdWallet = mnee.HDWallet(mnemonic, {
    derivationPath: "m/44'/236'/0'",
    cacheSize: 100
  });
  
  // Generate first few addresses
  const addresses = [];
  for (let i = 0; i < 5; i++) {
    const info = hdWallet.deriveAddress(i, false);
    addresses.push(info.address);
  }
  
  return {
    mnemonic,  // Save this securely!
    addresses
  };
}
```

### Restore Wallet from Mnemonic

```typescript
async function restoreWallet(mnemonic, mneeInstance) {
  // Validate mnemonic
  if (!HDWallet.isValidMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic phrase');
  }
  
  // Create HD wallet
  const hdWallet = mneeInstance.HDWallet(mnemonic, {
    derivationPath: "m/44'/236'/0'"
  });
  
  // Scan for used addresses
  const usedAddresses = [];
  let consecutiveUnused = 0;
  const gapLimit = 20;
  
  for (let i = 0; consecutiveUnused < gapLimit; i++) {
    const info = hdWallet.deriveAddress(i, false);
    const balance = await mneeInstance.balance(info.address);
    
    if (balance.decimalAmount > 0) {
      usedAddresses.push({
        ...info,
        balance: balance.decimalAmount
      });
      consecutiveUnused = 0;
    } else {
      consecutiveUnused++;
    }
  }
  
  return usedAddresses;
}
```

### HD Wallet Send

```typescript
async function hdWalletSend(hdWallet, recipients, totalAmount) {
  // Collect UTXOs from HD addresses
  const utxos = [];
  const wifs = {};
  let collected = 0;
  
  for (let i = 0; collected < totalAmount && i < 100; i++) {
    const info = hdWallet.deriveAddress(i, false);
    const addressUtxos = await mnee.getUtxos(info.address);
    
    if (addressUtxos.length > 0) {
      utxos.push(...addressUtxos);
      wifs[info.address] = info.privateKey;
      
      const addressTotal = addressUtxos.reduce(
        (sum, utxo) => sum + utxo.data.bsv21.amt, 0
      );
      collected += mnee.fromAtomicAmount(addressTotal);
    }
  }
  
  // Prepare inputs for transferMulti
  const inputs = utxos.map(utxo => ({
    txid: utxo.outpoint.split(':')[0],
    vout: parseInt(utxo.outpoint.split(':')[1]),
    wif: wifs[utxo.owners[0]]
  }));
  
  // Use next change address
  const changeInfo = hdWallet.deriveAddress(0, true);
  
  // Send transaction
  const response = await mnee.transferMulti({
    inputs,
    recipients,
    changeAddress: changeInfo.address
  });
  
  return response.txid;
}
```

### Address Labeling System

```typescript
class HDWalletManager {
  constructor(mnee, mnemonic, options) {
    this.hdWallet = mnee.HDWallet(mnemonic, options);
    this.labels = new Map(); // address -> label
    this.addressIndex = { receive: 0, change: 0 };
  }
  
  generateNewAddress(label, isChange = false) {
    const index = isChange ? 
      this.addressIndex.change++ : 
      this.addressIndex.receive++;
    
    const info = this.hdWallet.deriveAddress(index, isChange);
    this.labels.set(info.address, label);
    
    return {
      ...info,
      label,
      index,
      type: isChange ? 'change' : 'receive'
    };
  }
  
  getAddressByLabel(label) {
    for (const [address, addrLabel] of this.labels) {
      if (addrLabel === label) {
        return address;
      }
    }
    return null;
  }
  
  async getBalanceReport() {
    const report = [];
    
    for (const [address, label] of this.labels) {
      const balance = await mnee.balance(address);
      report.push({
        address,
        label,
        balance: balance.decimalAmount
      });
    }
    
    return report;
  }
}
```

### Backup and Recovery

```typescript
function exportWalletData(hdWallet, maxAddresses = 100) {
  const backup = {
    version: 1,
    created: new Date().toISOString(),
    addresses: {
      receive: [],
      change: []
    }
  };
  
  // Export receive addresses
  for (let i = 0; i < maxAddresses; i++) {
    const info = hdWallet.deriveAddress(i, false);
    backup.addresses.receive.push({
      index: i,
      address: info.address,
      path: info.path
    });
  }
  
  // Export change addresses
  for (let i = 0; i < maxAddresses / 2; i++) {
    const info = hdWallet.deriveAddress(i, true);
    backup.addresses.change.push({
      index: i,
      address: info.address,
      path: info.path
    });
  }
  
  return backup;
}
```

### Simplified Private Key Retrieval

The `getPrivateKeys` method provides a simpler interface for just getting private keys:

```typescript
const addresses = ['1Address1...', '1Address2...'];
const privateKeys = hdWallet.getPrivateKeys(addresses, {
  maxScanReceive: 5000,
  maxScanChange: 5000,
  scanStrategy: 'parallel'
});
// Returns: { '1Address1...': 'L1PrivateKey...', '1Address2...': 'L2PrivateKey...' }
```

### Scan Addresses with Gap Limit

Use the BIP44 standard gap limit scanning to find all used addresses:

```typescript
const checkAddressUsed = async (address) => {
  const balance = await mnee.balance(address);
  return balance.amount > 0;
};

const discovered = await hdWallet.scanAddressesWithGapLimit(
  checkAddressUsed,
  {
    gapLimit: 20,        // Standard BIP44 gap limit
    scanChange: true,    // Also scan change addresses
    maxScan: 10000      // Maximum addresses to scan
  }
);

console.log('Receive addresses:', discovered.receive);
console.log('Change addresses:', discovered.change);
```

### Cache Management

```typescript
// Clear the cache to free memory
hdWallet.clearCache();

// Check current cache size
const cacheSize = hdWallet.getCacheSize();
console.log(`Cache contains ${cacheSize} addresses`);
```

## Best Practices

### Security

- **Never store mnemonics in plain text**
- **Use secure key storage solutions**
- **Implement proper access controls**
- **Clear sensitive data from memory when done**

### Performance

- **Use appropriate cache sizes** based on your needs
- **Batch operations** when deriving multiple addresses
- **Scan efficiently** using gap limits

### Address Management

- **Follow BIP44 standards** for derivation paths
- **Use separate addresses** for each transaction (privacy)
- **Track address indexes** to avoid reuse
- **Implement gap limit** scanning (typically 20)

## Derivation Paths

Standard BIP44 path format: `m/purpose'/coin'/account'/change/index`

- **Purpose**: 44' (BIP44)
- **Coin**: 236' (BSV)
- **Account**: 0' (first account)
- **Change**: 0 (external) or 1 (internal)
- **Index**: Address index (0, 1, 2, ...)

Example paths:
- First receive address: `m/44'/236'/0'/0/0`
- First change address: `m/44'/236'/0'/1/0`
- 10th receive address: `m/44'/236'/0'/0/9`

## See Also

- [Transfer Multi](./transferMulti.md) - Use HD wallet addresses for transfers
- [Get UTXOs](./getUtxos.md) - Scan HD addresses for UTXOs
- [Batch Operations](./batch.md) - Process many HD addresses efficiently