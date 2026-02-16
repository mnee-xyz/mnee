import assert from "assert";
import { MneeERC20 } from "@mnee/ts-sdk";

const PK = "0xa5180d013b7d82923f1bb9938c23003c460455ed537a8910df46c4e169301440";
const sdk = new MneeERC20("TESTNET", PK);
//const TOKEN_ADDRESS = "0x7CFceCE31146f39a2fC6A60edB3870Bcbc18F5Aa";

// Test 19.1: Check balance
async function testBalancePositive() {
  const balance = await sdk.balance(
    "0xdb03C44A8C63f2c2d057A252b35f4483F97Dd230"
  );

  assert(balance === "500.0", "No Balance");

  console.log("  getBalance positive ✓");
}

// Test 19.1: Test invalid address
async function testInvalidAddress() {
  let failed = false;

  try {
    await sdk.balance("invalid-address");
  } catch (e) {
    failed = true;
    assert.ok(
      e.message.includes("invalid") || e.message.includes("address"),
      "Error should mention invalid address"
    );
  }

  assert.ok(failed, "Invalid address should fail");
  console.log("  invalid address ✓");
}

// Test 19.1: Test Empty request
async function testEmptyRequest() {
  let failed = false;

  try {
    await sdk.balance();
  } catch {
    failed = true;
  }

  assert.ok(failed, "Empty getBalance request should fail");
  console.log("  empty request ✓");
}

async function run() {
  console.log("Test: ERC20 getBalance");
  await testBalancePositive();
  await testInvalidAddress();
  await testEmptyRequest();
  console.log("✅ balance tests passed\n");
}

run().catch(err => {
  console.error("❌ balance test failed:", err.message);
  process.exit(1);
});
