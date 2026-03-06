# Transfer MNEE

The `transfer` method transfers MNEE token.
## Usage

### Basic Transfer

```typescript
import MneeERC20 from "@mnee/ts-sdk/erc20";

const PK = "0xa5180d013b7d82923f1bb9938c23003c460455ed537a8910df46c4e169301440";
const sdk = new MneeErc20("TESTNET", PK);

const recipient = '0xdb03C44A8C63f2c2d057A252b35f4483F97Aa230';
const amount = "500";
const response = await sdk.transfer(recipient, amount);
console.log('Transaction Hash', txHash);
```
