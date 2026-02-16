# Get Configuration

The `config` method retrieves the current configuration for the MNEE service.

## Usage

```typescript
import { MneeErc20 } from "@mnee/ts-sdk";

const PK = "0xa5180d013b7d82923f1bb9938c23003c460455ed537a8910df46c4e169301440";
const sdk = new MneeErc20("TESTNET", PK);

mnee.config().then(mneeConfig => {
  console.log('MNEE Configuration:', mneeConfig);
});
```