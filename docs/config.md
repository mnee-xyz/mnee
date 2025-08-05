# Get Configuration

The `config` method retrieves the current configuration for the MNEE service. This configuration includes essential parameters such as the token ID, current fees, and other settings required for interacting with the MNEE network.

## Usage

```typescript
import Mnee from 'mnee';

const config = {
  environment: 'sandbox', // or 'production'
  apiKey: 'your-api-key', // optional
};
const mnee = new Mnee(config);

mnee.config().then(mneeConfig => {
  console.log('MNEE Configuration:', mneeConfig);
});
```

## Response

The method returns a Promise that resolves to an `MNEEConfig` object, which contains the configuration details.

### Sample Response

```json
{
  "approver": "020a177d6a5e6f3a8689acd2e313bd1cf0dcf5a243d1cc67b7218602aee9e04b2f",
  "feeAddress": "19Vq2TV8aVhFNLQkhDMdnEQ7zT96x6F3PK",
  "burnAddress": "1FGEBTUu7EqWWK5DKrG6pxjEGLahpATnA8",
  "mintAddress": "1inHbiwj2jrEcZPiSYnfgJ8FmS1Bmk4Dh",
  "fees": [
    { "min": 0, "max": 1000000, "fee": 100 },
    { "min": 1000001, "max": 9007199254740991, "fee": 1000 }
  ],
  "decimals": 5,
  "tokenId": "ae59f3b898ec61acbdb6cc7a245fabeded0c094bf046f35206a3aec60ef88127_0"
}
```

## Configuration Properties

- **approver**: The public key of the MNEE approver/cosigner service
- **feeAddress**: The address where transaction fees are sent
- **burnAddress**: The address used for burning MNEE tokens
- **mintAddress**: The address used for minting new MNEE tokens
- **fees**: Array of fee tiers based on transaction amount
  - **min**: Minimum amount for this fee tier (in atomic units)
  - **max**: Maximum amount for this fee tier (in atomic units)
  - **fee**: Fee amount for this tier (in atomic units)
- **decimals**: Number of decimal places for MNEE (5 decimals = 100,000 atomic units per MNEE)
- **tokenId**: The unique identifier for the MNEE token on the blockchain

## Common Use Cases

### Calculate Transaction Fees

```typescript
const config = await mnee.config();
const transferAmount = mnee.toAtomicAmount(10); // 10 MNEE

// Find applicable fee tier
const feeTier = config.fees.find(tier => 
  transferAmount >= tier.min && transferAmount <= tier.max
);

if (feeTier) {
  const feeInMNEE = mnee.fromAtomicAmount(feeTier.fee);
  console.log(`Fee for 10 MNEE transfer: ${feeInMNEE} MNEE`);
}
```

### Verify Token Configuration

```typescript
const config = await mnee.config();
console.log(`Token ID: ${config.tokenId}`);
console.log(`Decimals: ${config.decimals}`);
console.log(`1 MNEE = ${Math.pow(10, config.decimals)} atomic units`);
```

### Check Special Addresses

```typescript
const config = await mnee.config();
console.log('Fee collection address:', config.feeAddress);
console.log('Burn address:', config.burnAddress);
console.log('Mint address:', config.mintAddress);
```

### Validate Approver Key

```typescript
const config = await mnee.config();
console.log('Approver public key:', config.approver);
// This key is used to validate MNEE transactions
```

## Notes

- The configuration is cached after the first call for performance
- Fee tiers are applied based on the transaction amount in atomic units
- The approver public key is essential for validating MNEE transactions
- All amounts in the fees array are in atomic units (1 MNEE = 100,000 atomic units)

## See Also

- [Validate Transaction](./validateMneeTx.md) - Validate transactions using approver configuration
- [Transfer](./transfer.md) - Create transfers with automatic fee calculation
- [Unit Conversion](./unitConversion.md) - Convert between MNEE and atomic units