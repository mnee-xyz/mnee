# Parse Scripts

The MNEE SDK provides methods to parse inscription data and cosigner information from Bitcoin scripts.

## Parse Inscription

The `parseInscription` method extracts inscription data from a Bitcoin script. This is useful for analyzing on-chain data and understanding transaction metadata.

### Usage

```typescript
import { Script } from '@bsv/sdk';

const script = Script.fromHex('...');
const inscription = mnee.parseInscription(script);
console.log('Inscription:', inscription);
```

### Response

Returns an `Inscription` object or `undefined` if no inscription is found:

```typescript
{
  file?: {
    hash: string;
    size: number;
    type: string;
    content: number[];
  };
  fields?: {
    [key: string]: any;
  };
  parent?: string;
}
```

## Parse Cosigner Scripts

The `parseCosignerScripts` method extracts cosigner public keys and addresses from an array of scripts.

### Usage

```typescript
import { Script } from '@bsv/sdk';

const scripts = [
  Script.fromHex('...'),
  Script.fromHex('...')
];

const cosigners = mnee.parseCosignerScripts(scripts);
console.log('Cosigner addresses:', cosigners);
```

### Response

Returns an array of `ParsedCosigner` objects:

```typescript
[
  {
    cosigner: "03d47c2e48c59b3f58b96c9e616d0a84c6e02725e47beefcb5b5a8fbe21a3c5e3a",
    address: "17cgGUmStWwcYgHg3kxmzXSp6JUbj8XA3u"
  }
]
```

## Common Use Cases

### Extract Inscription Data

```typescript
async function analyzeInscription(txid) {
  // Get transaction details
  const parsed = await mnee.parseTx(txid, { includeRaw: true });
  
  // Check each output for inscriptions
  for (const output of parsed.raw.outputs) {
    const script = Script.fromHex(output.scriptPubKey);
    const inscription = mnee.parseInscription(script);
    
    if (inscription) {
      console.log('Found inscription:', inscription);
      
      if (inscription.file) {
        console.log(`File type: ${inscription.file.type}`);
        console.log(`File size: ${inscription.file.size} bytes`);
        console.log(`File hash: ${inscription.file.hash}`);
      }
      
      if (inscription.fields) {
        console.log('Custom fields:', inscription.fields);
      }
    }
  }
}
```

### Verify Cosigner Authorization

```typescript
async function verifyCosigner(rawTxHex) {
  const tx = Transaction.fromHex(rawTxHex);
  const scripts = tx.outputs.map(output => output.script);
  
  const cosigners = mnee.parseCosignerScripts(scripts);
  
  // Get expected cosigner from config
  const config = await mnee.config();
  const expectedCosigner = config.approver;
  
  // Verify cosigner
  const authorized = cosigners.some(
    c => c.cosigner === expectedCosigner
  );
  
  if (!authorized) {
    throw new Error('Transaction not authorized by cosigner');
  }
  
  return cosigners;
}
```

### Extract Metadata from Transactions

```typescript
async function extractMetadata(txid) {
  const parsed = await mnee.parseTx(txid, { includeRaw: true });
  const metadata = {
    inscriptions: [],
    cosigners: [],
    customData: {}
  };
  
  // Process outputs
  for (let i = 0; i < parsed.raw.outputs.length; i++) {
    const output = parsed.raw.outputs[i];
    const script = Script.fromHex(output.scriptPubKey);
    
    // Check for inscription
    const inscription = mnee.parseInscription(script);
    if (inscription) {
      metadata.inscriptions.push({
        outputIndex: i,
        inscription
      });
    }
    
    // Check for cosigner
    const cosigners = mnee.parseCosignerScripts([script]);
    if (cosigners.length > 0) {
      metadata.cosigners.push({
        outputIndex: i,
        cosigner: cosigners[0]
      });
    }
  }
  
  return metadata;
}
```

### Analyze File Inscriptions

```typescript
function analyzeFileInscription(inscription) {
  if (!inscription?.file) {
    return null;
  }
  
  const analysis = {
    type: inscription.file.type,
    size: inscription.file.size,
    hash: inscription.file.hash,
    humanSize: formatBytes(inscription.file.size),
    isImage: inscription.file.type.startsWith('image/'),
    isText: inscription.file.type.startsWith('text/'),
    isJson: inscription.file.type === 'application/json'
  };
  
  // Extract content if it's text
  if (analysis.isText || analysis.isJson) {
    try {
      const text = Buffer.from(inscription.file.content).toString('utf8');
      analysis.content = analysis.isJson ? JSON.parse(text) : text;
    } catch (e) {
      analysis.contentError = e.message;
    }
  }
  
  return analysis;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
```

### Find Transactions with Specific Inscriptions

```typescript
async function findInscriptionsByType(addresses, fileType) {
  const matches = [];
  
  for (const address of addresses) {
    const history = await mnee.recentTxHistory(address, undefined, 100);
    
    for (const tx of history.history) {
      const parsed = await mnee.parseTx(tx.txid, { includeRaw: true });
      
      for (const output of parsed.raw.outputs) {
        const script = Script.fromHex(output.scriptPubKey);
        const inscription = mnee.parseInscription(script);
        
        if (inscription?.file?.type === fileType) {
          matches.push({
            txid: tx.txid,
            address: output.address,
            inscription
          });
        }
      }
    }
  }
  
  return matches;
}
```

### Build Custom Scripts

```typescript
// Example: Create a script with custom data
function createCustomScript(data) {
  const script = new Script();
  
  // Add OP_RETURN for data storage
  script.writeOpCode(OpCode.OP_RETURN);
  
  // Add custom data
  const dataBuffer = Buffer.from(JSON.stringify(data));
  script.writeBin(dataBuffer);
  
  return script;
}

// Verify custom data
function parseCustomScript(script) {
  const chunks = script.chunks;
  
  if (chunks[0]?.opCode === OpCode.OP_RETURN && chunks[1]?.buf) {
    try {
      const data = JSON.parse(chunks[1].buf.toString('utf8'));
      return data;
    } catch (e) {
      return null;
    }
  }
  
  return null;
}
```

## Important Notes

- Not all scripts contain inscriptions or cosigner data
- The `parseInscription` method returns `undefined` if no inscription is found
- Cosigner scripts are typically found in MNEE transaction outputs
- File content in inscriptions is stored as a byte array
- Always handle the case where parsing returns no data

## Script Types

MNEE transactions may contain various script types:

1. **Standard P2PKH**: Regular Bitcoin addresses
2. **Inscription Scripts**: Contain embedded data/files
3. **Cosigner Scripts**: Include cosigner authorization
4. **Multi-signature Scripts**: Require multiple signatures

## See Also

- [Parse Transaction](./parseTx.md) - Get full transaction details
- [Validate Transaction](./validateMneeTx.md) - Verify transaction validity
- [Configuration](./config.md) - Get expected cosigner information