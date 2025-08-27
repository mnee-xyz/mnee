# Transfer Multi

The `transferMulti` method enables advanced MNEE transfers using multiple source UTXOs with different private keys. This method provides full control over which UTXOs to spend and is essential for complex wallet operations like consolidation, HD wallet transfers, and multi-signature scenarios.

## Usage

### Basic Multi-Source Transfer

```typescript
const options = {
  inputs: [
    { txid: 'abc123...', vout: 0, wif: 'L1PrivateKey...' },
    { txid: 'def456...', vout: 1, wif: 'L2PrivateKey...' }
  ],
  recipients: [
    { address: '1DestinationAddress...', amount: 100 }
  ],
  changeAddress: '1ChangeAddress...'
};

const response = await mnee.transferMulti(options);
console.log('Ticket ID:', response.ticketId);

// Check transaction status
const status = await mnee.getTxStatus(response.ticketId);
console.log('Transaction ID:', status.tx_id);
```

### Multiple Change Addresses

```typescript
const options = {
  inputs: [
    { txid: 'abc123...', vout: 0, wif: 'L1...' },
    { txid: 'def456...', vout: 1, wif: 'L2...' },
    { txid: 'ghi789...', vout: 0, wif: 'L3...' }
  ],
  recipients: [
    { address: '1Recipient...', amount: 50 }
  ],
  changeAddress: [
    { address: '1Change1...', amount: 30 },
    { address: '1Change2...', amount: 20 }
  ]
};

const response = await mnee.transferMulti(options);
console.log('Ticket ID:', response.ticketId);
```

### Transfer with Webhook Callback

```typescript
const options = {
  inputs: [
    { txid: 'abc123...', vout: 0, wif: 'L1...' },
    { txid: 'def456...', vout: 1, wif: 'L2...' }
  ],
  recipients: [
    { address: '1Recipient...', amount: 75 }
  ]
};

// Add webhook for async status updates
const response = await mnee.transferMulti(options, {
  broadcast: true,
  callbackUrl: 'https://your-api.com/webhook'
});

console.log('Ticket ID:', response.ticketId);
// Your webhook will receive status updates
```

## Parameters

### TransferMultiOptions

- **inputs**: Array of input UTXOs to spend
  - **txid**: Transaction ID of the UTXO
  - **vout**: Output index within the transaction
  - **wif**: Private key (WIF format) that controls this UTXO
- **recipients**: Array of `SendMNEE` objects for destinations
  - **address**: Recipient address
  - **amount**: Amount in MNEE
- **changeAddress** (optional): Where to send change
  - Can be a single address (string)
  - Or array of addresses with specific amounts

### TransferOptions (second parameter, optional)

- **broadcast**: Whether to broadcast the transaction (default: `true`)
- **callbackUrl**: Webhook URL for status updates (only when broadcast is true)

## Response

Returns a `TransferResponse` object:

```typescript
{
  ticketId?: string;  // Ticket ID for tracking (only if broadcast is true)
  rawtx?: string;     // The raw transaction hex (only if broadcast is false)
}
```

## Common Use Cases

### UTXO Consolidation

```typescript
async function consolidateUTXOs(address, wif) {
  // Get all UTXOs for the address
  const utxos = await mnee.getUtxos(address);
  
  // Calculate total amount
  const totalAmount = utxos.reduce((sum, utxo) => 
    sum + utxo.data.bsv21.amt, 0
  );
  const totalMNEE = mnee.fromAtomicAmount(totalAmount);
  
  // Prepare inputs
  const inputs = utxos.map(utxo => ({
    txid: utxo.outpoint.split(':')[0],
    vout: parseInt(utxo.outpoint.split(':')[1]),
    wif: wif
  }));
  
  // Send all to same address (minus estimated fee)
  const response = await mnee.transferMulti({
    inputs,
    recipients: [{ address, amount: totalMNEE - 0.001 }], // Leave some for fee
    changeAddress: address
  });
  
  console.log(`Consolidated ${utxos.length} UTXOs into 1`);
  
  // Get transaction ID from status
  const status = await mnee.getTxStatus(response.ticketId);
  return status.tx_id;
}
```

### HD Wallet Transfer

```typescript
async function hdWalletTransfer(hdWallet, recipients, totalAmount) {
  // Find addresses with balance
  const addresses = [];
  const wifs = {};
  let collectedAmount = 0;
  
  for (let i = 0; collectedAmount < totalAmount && i < 100; i++) {
    const derived = hdWallet.deriveAddress(i, false);
    const balance = await mnee.balance(derived.address);
    
    if (balance.decimalAmount > 0) {
      addresses.push(derived.address);
      wifs[derived.address] = derived.wif;
      collectedAmount += balance.decimalAmount;
    }
  }
  
  // Get UTXOs for all addresses (specify size to get all)
  const allUtxos = await mnee.getUtxos(addresses, 0, 1000);
  
  // Prepare inputs
  const inputs = allUtxos.map(utxo => ({
    txid: utxo.outpoint.split(':')[0],
    vout: parseInt(utxo.outpoint.split(':')[1]),
    wif: wifs[utxo.owners[0]]
  }));
  
  // Create transfer
  const response = await mnee.transferMulti({
    inputs,
    recipients,
    changeAddress: hdWallet.deriveAddress(0, true).address // change address
  });
  
  // Wait for confirmation
  const status = await mnee.getTxStatus(response.ticketId);
  return status.tx_id;
}
```

### Multi-Wallet Aggregation

```typescript
async function aggregateFromMultipleWallets(wallets, destinationAddress) {
  const allInputs = [];
  let totalAmount = 0;
  
  // Collect UTXOs from each wallet
  for (const wallet of wallets) {
    const utxos = await mnee.getUtxos(wallet.address);
    
    for (const utxo of utxos) {
      allInputs.push({
        txid: utxo.outpoint.split(':')[0],
        vout: parseInt(utxo.outpoint.split(':')[1]),
        wif: wallet.wif
      });
      totalAmount += utxo.data.bsv21.amt;
    }
  }
  
  const totalMNEE = mnee.fromAtomicAmount(totalAmount);
  
  // Transfer all to destination
  const response = await mnee.transferMulti({
    inputs: allInputs,
    recipients: [{ 
      address: destinationAddress, 
      amount: totalMNEE - 0.002 // Leave room for fees
    }]
  });
  
  console.log(`Aggregated from ${wallets.length} wallets`);
  
  // Wait for transaction to be broadcast
  const status = await mnee.getTxStatus(response.ticketId);
  return status.tx_id;
}
```

### Distributed Change

```typescript
async function transferWithDistributedChange(inputs, recipient, changeAddresses) {
  // Calculate total input amount
  let totalInput = 0;
  for (const input of inputs) {
    // You'd need to look up UTXO amounts
    const utxo = await getUTXODetails(input.txid, input.vout);
    totalInput += utxo.amount;
  }
  
  const totalInputMNEE = mnee.fromAtomicAmount(totalInput);
  const changeAmount = totalInputMNEE - recipient.amount - 0.002; // fees
  
  // Distribute change evenly
  const changePerAddress = changeAmount / changeAddresses.length;
  const changeOutputs = changeAddresses.map(addr => ({
    address: addr,
    amount: changePerAddress
  }));
  
  const response = await mnee.transferMulti({
    inputs,
    recipients: [recipient],
    changeAddress: changeOutputs
  });
  
  return response;
}
```

### Specific UTXO Selection

```typescript
async function spendSpecificUTXOs(utxoList, recipient) {
  // utxoList contains specific UTXOs to spend
  const inputs = utxoList.map(utxo => ({
    txid: utxo.txid,
    vout: utxo.vout,
    wif: utxo.wif
  }));
  
  const response = await mnee.transferMulti({
    inputs,
    recipients: [recipient]
  }, { broadcast: false }); // Create but don't broadcast
  
  // Validate before broadcasting
  const isValid = await mnee.validateMneeTx(response.rawtx);
  if (isValid) {
    const result = await mnee.submitRawTx(response.rawtx);
    
    // Wait for confirmation
    const status = await mnee.getTxStatus(result.ticketId);
    return status.tx_id;
  }
  
  throw new Error('Transaction validation failed');
}
```

## Important Notes

- Each input must have its own WIF (private key)
- The method does NOT automatically select UTXOs - you must specify exact inputs
- Total input amount must cover recipients + fees
- Change calculation is manual unless using single change address
- When using multiple change addresses, ensure amounts are specified correctly
- Fees are automatically calculated and deducted from outputs

## Error Handling

The transferMulti method can throw several specific errors:

```typescript
try {
  const response = await mnee.transferMulti(options);
} catch (error) {
  switch (error.message) {
    case 'Config not fetched':
      console.error('Failed to fetch cosigner configuration');
      break;
    case 'Invalid transfer options':
      console.error('Invalid options structure');
      break;
    case 'Invalid amount':
      console.error('Total recipient amount must be greater than 0');
      break;
    case 'Insufficient MNEE balance':
      console.error('Input UTXOs don\'t cover output amounts + fees');
      break;
    case 'Failed to broadcast transaction':
      console.error('Cosigner rejected the transaction');
      break;
    case 'Invalid API key':
      console.error('API key authentication failed (401/403)');
      break;
    default:
      if (error.message.includes('Duplicate UTXO')) {
        console.error('Same UTXO used multiple times in inputs');
      } else if (error.message.includes('Invalid WIF')) {
        console.error('One or more private keys are invalid');
      } else if (error.message.includes('Failed to fetch UTXO')) {
        console.error('One or more input UTXOs not found or already spent');
      } else if (error.message.includes('HTTP error! status:')) {
        console.error('API request failed:', error.message);
      } else {
        console.error('Transfer failed:', error.message);
      }
  }
}
```

## See Also

- [Transfer](./transfer.md) - Simple transfers with automatic UTXO selection
- [Get UTXOs](./getUtxos.md) - Find available UTXOs to spend
- [Get Transaction Status](./getTxStatus.md) - Track transaction status
- [Transfer Webhooks](./transferWebhook.md) - Webhook callbacks for async updates
- [Submit Raw Transaction](./submitRawTx.md) - Broadcast created transactions