# HD Wallet Implementation for MNEE SDK

## Overview

The MNEE SDK now includes comprehensive HD (Hierarchical Deterministic) wallet support, addressing the limitation mentioned in the feedback that the original `mnee.transfer()` method "cannot sweep MNEE tokens from multiple derived child addresses using a single master private key or mnemonic."

This implementation provides full BIP32/BIP44 HD wallet functionality for MNEE tokens, enabling you to:
- Generate and manage HD wallets with mnemonic phrases
- Derive multiple addresses from a single seed
- Sweep funds from multiple HD-derived addresses in a single transaction
- Recover wallets using standard BIP39 mnemonic phrases
- Efficiently manage private keys for multiple addresses

## Key Differences from Standard MNEE Library

### Standard `mnee.transfer()` Limitations
```javascript
// Standard mnee.transfer() - Single address only
await mnee.transfer([
  { address: "recipient1", amount: 100 },
  { address: "recipient2", amount: 50 }
], "L1SingleWIFKey...");  // ❌ Can only use ONE source address
```

### New HD Wallet + `transferMulti()` Capabilities
```javascript
// New HD wallet support - Multiple source addresses
const hdWallet = mnee.HDWallet(mnemonic, { derivationPath: "m/44'/236'/0'" });

// Get private keys for multiple addresses
const { privateKeys } = hdWallet.getPrivateKeysForAddresses([addr1, addr2, addr3]);

// Sweep from multiple HD addresses
await mnee.transferMulti({
  inputs: [
    { txid: "...", vout: 0, wif: privateKeys[addr1] },  // ✅ From address 1
    { txid: "...", vout: 1, wif: privateKeys[addr2] },  // ✅ From address 2
    { txid: "...", vout: 0, wif: privateKeys[addr3] },  // ✅ From address 3
  ],
  recipients: [{ address: "destination", amount: totalAmount - fee }]
});
```

## Core HD Wallet Class

### Creating an HD Wallet
```javascript
import Mnee from 'mnee';

// Generate a new mnemonic
const mnemonic = Mnee.HDWallet.generateMnemonic();
console.log('Save this mnemonic:', mnemonic);

// Create HD wallet instance
const mnee = new Mnee({ environment: 'sandbox' });
const hdWallet = mnee.HDWallet(mnemonic, {
  derivationPath: "m/44'/236'/0'",  // Standard BIP44 path for MNEE
  cacheSize: 1000                    // Cache derived keys for performance
});
```

### Address Derivation
```javascript
// Derive a single address
const receiveAddr = hdWallet.deriveAddress(0, false);  // First receive address
const changeAddr = hdWallet.deriveAddress(0, true);    // First change address

console.log('Address:', receiveAddr.address);
console.log('Private Key:', receiveAddr.privateKey);
console.log('Path:', receiveAddr.path);  // "m/44'/236'/0'/0/0"

// Batch derive addresses for better performance
const addresses = await hdWallet.deriveAddresses(0, 10, false);  // 10 receive addresses
const changeAddresses = await hdWallet.deriveAddresses(0, 5, true);  // 5 change addresses
```

## Common HD Wallet Patterns

### 1. Wallet Recovery and Balance Checking

```javascript
async function recoverWallet(mnemonic) {
  const hdWallet = mnee.HDWallet(mnemonic, { derivationPath: "m/44'/236'/0'" });
  
  // Define function to check if address has been used
  const checkAddressUsed = async (address) => {
    const utxos = await mnee.getUtxos(address);
    return utxos.length > 0;
  };
  
  // Scan with gap limit (BIP44 standard)
  const scanResult = await hdWallet.scanAddressesWithGapLimit(checkAddressUsed, {
    gapLimit: 20,      // Stop after 20 consecutive unused addresses
    scanChange: true,  // Also scan change addresses
    maxScan: 1000      // Maximum addresses to scan
  });
  
  console.log('Found', scanResult.receive.length, 'used receive addresses');
  console.log('Found', scanResult.change.length, 'used change addresses');
  
  // Get total balance
  const allAddresses = [
    ...scanResult.receive.map(a => a.address),
    ...scanResult.change.map(a => a.address)
  ];
  
  const balances = await mnee.balances(allAddresses);
  const totalBalance = balances.reduce((sum, b) => sum + b.decimalAmount, 0);
  
  console.log('Total wallet balance:', totalBalance, 'MNEE');
  
  return { addresses: scanResult, totalBalance };
}
```

### 2. HD Wallet Sweep (Consolidation)

This pattern addresses the feedback limitation about sweeping from multiple addresses:

```javascript
async function sweepHDWallet(mnemonic, destinationAddress) {
  const hdWallet = mnee.HDWallet(mnemonic, { derivationPath: "m/44'/236'/0'" });
  
  // Step 1: Find all addresses with funds
  const addressesToCheck = [];
  
  // Check first 100 receive and 50 change addresses
  for (let i = 0; i < 100; i++) {
    const addr = hdWallet.deriveAddress(i, false);
    addressesToCheck.push(addr.address);
  }
  
  for (let i = 0; i < 50; i++) {
    const addr = hdWallet.deriveAddress(i, true);
    addressesToCheck.push(addr.address);
  }
  
  // Step 2: Get all UTXOs
  const utxos = await mnee.getUtxos(addressesToCheck);
  
  if (utxos.length === 0) {
    console.log('No UTXOs found in wallet');
    return;
  }
  
  // Step 3: Get private keys for addresses with UTXOs
  const utxoAddresses = [...new Set(utxos.map(u => u.owners[0]))];
  const { privateKeys } = hdWallet.getPrivateKeysForAddresses(utxoAddresses);
  
  // Step 4: Build inputs for transferMulti
  const inputs = utxos.map(utxo => ({
    txid: utxo.txid,
    vout: utxo.vout,
    wif: privateKeys[utxo.owners[0]]  // Private key for this specific UTXO
  }));
  
  // Step 5: Calculate total and fee
  const totalAtomic = utxos.reduce((sum, u) => sum + u.data.bsv21.amt, 0);
  const totalDecimal = mnee.fromAtomicAmount(totalAtomic);
  
  // Get dynamic fee from config
  const config = await mnee.config();
  let feeAmount = 0.001; // Default
  if (config && config.fees) {
    const applicableFee = config.fees.find(
      tier => totalDecimal >= tier.min && totalDecimal <= tier.max
    );
    if (applicableFee) {
      feeAmount = mnee.fromAtomicAmount(applicableFee.fee);
    }
  }
  
  const recipientAmount = totalDecimal - feeAmount;
  
  // Step 6: Execute sweep using transferMulti
  const result = await mnee.transferMulti({
    inputs,
    recipients: [{
      address: destinationAddress,
      amount: recipientAmount
    }]
  });
  
  if (result.txid) {
    console.log('✅ Swept', totalDecimal, 'MNEE from', inputs.length, 'UTXOs');
    console.log('Transaction:', result.txid);
  }
  
  return result;
}
```

### 3. Export Funded Addresses

```javascript
async function exportFundedAddresses(mnemonic, options = {}) {
  const {
    maxReceiveAddresses = 100,
    maxChangeAddresses = 50,
    includePrivateKeys = false,
    format = 'json'
  } = options;
  
  const hdWallet = mnee.HDWallet(mnemonic, { derivationPath: "m/44'/236'/0'" });
  
  // Derive addresses
  const receiveAddresses = await hdWallet.deriveAddresses(0, maxReceiveAddresses, false);
  const changeAddresses = await hdWallet.deriveAddresses(0, maxChangeAddresses, true);
  
  // Create lookup map
  const addressMap = new Map();
  receiveAddresses.forEach((info, i) => {
    addressMap.set(info.address, { ...info, type: 'receive', index: i });
  });
  changeAddresses.forEach((info, i) => {
    addressMap.set(info.address, { ...info, type: 'change', index: i });
  });
  
  const allAddresses = [...addressMap.keys()];
  
  // Get balances and UTXOs in parallel
  const [utxos, balances] = await Promise.all([
    mnee.getUtxos(allAddresses),
    mnee.balances(allAddresses)
  ]);
  
  // Build funded address list
  const fundedAddresses = balances
    .filter(b => b.decimalAmount > 0)
    .map(b => {
      const info = addressMap.get(b.address);
      const addressUtxos = utxos.filter(u => u.owners[0] === b.address);
      
      const result = {
        address: b.address,
        balance: b.decimalAmount,
        utxoCount: addressUtxos.length,
        type: info.type,
        index: info.index,
        path: info.path
      };
      
      if (includePrivateKeys) {
        result.privateKey = info.privateKey;
      }
      
      return result;
    })
    .sort((a, b) => b.balance - a.balance);
  
  const totalBalance = fundedAddresses.reduce((sum, a) => sum + a.balance, 0);
  
  if (format === 'csv') {
    // Output as CSV
    const headers = includePrivateKeys 
      ? 'Address,Balance,UTXOs,Type,Index,Path,PrivateKey'
      : 'Address,Balance,UTXOs,Type,Index,Path';
    
    console.log(headers);
    fundedAddresses.forEach(addr => {
      const row = includePrivateKeys
        ? `${addr.address},${addr.balance},${addr.utxoCount},${addr.type},${addr.index},${addr.path},${addr.privateKey}`
        : `${addr.address},${addr.balance},${addr.utxoCount},${addr.type},${addr.index},${addr.path}`;
      console.log(row);
    });
  } else {
    // Return as JSON
    return {
      fundedAddresses,
      totalBalance,
      totalUTXOs: utxos.length
    };
  }
}
```

### 4. Private Key Retrieval Strategies

The HD wallet provides flexible private key retrieval with different scanning strategies:

```javascript
// Example 1: Get private keys with sequential scanning
const { privateKeys, paths } = hdWallet.getPrivateKeysForAddresses(
  ['1Address1...', '1Address2...'],
  {
    maxScanReceive: 10000,    // Scan up to 10k receive addresses
    maxScanChange: 5000,      // Scan up to 5k change addresses  
    scanStrategy: 'sequential' // Check all receive first, then change
  }
);

// Example 2: Get private keys with parallel scanning (faster for mixed addresses)
const keysParallel = hdWallet.getPrivateKeysForAddresses(
  addresses,
  { scanStrategy: 'parallel' }  // Interleave receive/change scanning
);

// Example 3: Simple private key retrieval (just the keys)
const justKeys = hdWallet.getPrivateKeys(addresses);
// Returns: { "1Address...": "L1PrivateKey...", ... }
```

## Integration with Existing MNEE Code

### Refactoring from Single Address to HD Wallet

**Before (Single Address):**
```javascript
// Old approach - limited to single source address
const WIF = 'L1PrivateKey...';
const address = getAddressFromWIF(WIF);

// Get balance
const balance = await mnee.balance(address);

// Transfer
await mnee.transfer([
  { address: 'recipient', amount: 100 }
], WIF);
```

**After (HD Wallet):**
```javascript
// New approach - multiple addresses from mnemonic
const hdWallet = mnee.HDWallet(mnemonic, { derivationPath: "m/44'/236'/0'" });

// Get balance across multiple addresses
const addresses = await hdWallet.deriveAddresses(0, 10);
const balances = await mnee.balances(addresses.map(a => a.address));
const totalBalance = balances.reduce((sum, b) => sum + b.decimalAmount, 0);

// Transfer from specific HD address
const addr = hdWallet.deriveAddress(0);
await mnee.transfer([
  { address: 'recipient', amount: 100 }
], addr.privateKey);

// Or sweep from multiple addresses
await sweepHDWallet(mnemonic, 'destination');
```

### Working with transferMulti

The `transferMulti` method is essential for HD wallet operations:

```javascript
// Structure for transferMulti
await mnee.transferMulti({
  inputs: [
    {
      txid: 'abc123...',
      vout: 0,
      wif: 'L1PrivateKeyForThisUTXO...'
    },
    // More inputs from different addresses
  ],
  recipients: [
    {
      address: 'destination1',
      amount: 50
    },
    {
      address: 'destination2', 
      amount: 25
    }
  ],
  changeAddress: 'explicitChangeAddress' // Optional
});
```

## Best Practices

### 1. Mnemonic Security
```javascript
// Always validate mnemonics before use
if (!Mnee.HDWallet.isValidMnemonic(mnemonic)) {
  throw new Error('Invalid mnemonic phrase');
}

// Store mnemonics securely - never in plain text
// Consider encryption or secure key management services
```

### 2. Performance Optimization
```javascript
// Use batch derivation for better performance
const addresses = await hdWallet.deriveAddresses(0, 100); // ✅ Efficient

// Avoid individual derivation in loops
for (let i = 0; i < 100; i++) {
  const addr = hdWallet.deriveAddress(i); // ❌ Slower
}

// Clear cache when done with large operations
hdWallet.clearCache();
```

### 3. Gap Limit Compliance
```javascript
// Always use gap limit scanning for wallet recovery
const scanResult = await hdWallet.scanAddressesWithGapLimit(
  checkFunction,
  { gapLimit: 20 } // BIP44 standard
);
```

### 4. Fee Calculation
```javascript
// Always use dynamic fees from config
const config = await mnee.config();
const fee = config.fees.find(tier => 
  amount >= tier.min && amount <= tier.max
);
const feeAmount = mnee.fromAtomicAmount(fee.fee);
```

## Migration Guide

From the volume-manager pattern mentioned in feedback.md:

### From CosignTemplate.transferMany to transferMulti

The MNEE SDK's `transferMulti` provides similar functionality to volume-manager's `CosignTemplate.transferMany`:

```javascript
// volume-manager pattern
cosignTemplate.transferMany(transferRequest, {
  utxos: ['txid:vout', ...],
  privateKeys: {
    "1Address1": "L1WIF1",
    "1Address2": "L2WIF2"
  },
  changeAddress: "1ChangeAddr"
});

// MNEE SDK equivalent
await mnee.transferMulti({
  inputs: utxos.map(utxo => ({
    txid: utxo.split(':')[0],
    vout: parseInt(utxo.split(':')[1]),
    wif: privateKeys[getAddressFromUTXO(utxo)]
  })),
  recipients: transferRequest,
  changeAddress: "1ChangeAddr"
});
```

## Complete Working Example

For a comprehensive working example that demonstrates all HD wallet features, see the included `temp/test-hd-wallet.js` file. This test file provides:

- Complete HD wallet setup and configuration
- Address derivation and funding examples
- Balance checking across multiple addresses
- UTXO retrieval and transaction parsing
- HD wallet recovery using gap limit scanning
- Multi-address sweep consolidation
- Private key retrieval strategies
- All utility functions (`exportFundedAddresses`, `sweepHDWallet`) ready to use

To run the test:
```bash
# Ensure you have built the SDK
npm run build

# Update the FUNDED_WIF and FUNDED_ADDRESS constants in temp/test-hd-wallet.js
# Run the test
node temp/test-hd-wallet.js
```

The test file serves as both a comprehensive example and a validation suite for HD wallet functionality.

## Summary

The HD wallet implementation in MNEE SDK addresses all the limitations mentioned in the feedback:

1. ✅ **Multi-address sweeping**: Full support via `transferMulti` with HD-derived private keys
2. ✅ **Mnemonic support**: Standard BIP39 mnemonic generation and recovery
3. ✅ **Granular control**: Explicit control over inputs, outputs, and change addresses
4. ✅ **No circular dependencies**: Clean separation between key derivation and transaction operations
5. ✅ **Performance optimized**: Batch operations and caching for efficient address derivation

This implementation provides the tools needed to build sophisticated MNEE token management applications while maintaining compatibility with standard HD wallet conventions.