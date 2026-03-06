import assert from "assert";
import MneeERC20 from "@mnee/ts-sdk/erc20";

const PK = "0xa5180d013b7d82923f1bb9938c23003c460455ed537a8910df46c4e169301440";
const sdk = new MneeERC20("TESTNET");

// Test 20.1: Test token config
async function testTokenConfig() {
  const token = await sdk.config();

  assert(token.symbol==='MNEE', "Token instance should be created");

  console.log("  API creation ✓");
}

// Test 20.1: Test token metadata
async function testMetadata() {
  const token = await sdk.config();

  assert(token.name);
  assert(token.symbol);
  assert(typeof token.decimals === "bigint" && token.decimals === 18n);

  console.log("  metadata ✓");
}

// Test 20.1: Test total supply
async function testTotalSupply() {
  const token = await sdk.config();
  const supply = await token.totalSupply;

  assert(typeof supply === "number" || typeof supply === "bigint");
  console.log(supply);
  console.log("  totalSupply ✓");
}

async function run() {
  console.log("Test: ERC20 config");
  await testTokenConfig();
  await testMetadata();
  await testTotalSupply();
  console.log("✅ config tests passed\n");
}

run().catch(err => {
  console.error("❌ config test failed:", err.message);
  process.exit(1);
});
