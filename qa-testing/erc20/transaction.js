import assert from "assert";
import { MneeErc20 } from "@mnee/ts-sdk";
import { solidityPackedSha256 } from "ethers";

const PK = "0xa5180d013b7d82923f1bb9938c23003c460455ed537a8910df46c4e169301440";

const sdk = new MneeErc20("TESTNET", PK);

const TO1 = "0xdb03C44A8C63f2c2d057A252b35f4483F97Dd230";
const TO2 = "0xEd23D46901D364C8F7bd974F5F6a321B55197892";
       
// Test 20.1: Test transfer amount
async function testTransferPositive() {

  const txHash = await sdk.transfer(TO1, "10");

  assert.ok(txHash.startsWith("0x"), "txHash should be returned");
  console.log("  transfer positive ✓");
}

// Test 20.2: Test transfer of insufficient balance
async function testInsufficientBalance() {
  let failed = false;

  try {
    await sdk.transfer(TO1, "999999999999");
  } catch {
    failed = true;
  }

  assert.ok(failed, "Insufficient balance should fail");
  console.log("  insufficient balance ✓");
}

// Test 20.3: Test Zero amount transfer
async function testZeroAmount() {
  let failed = false;

  try {
    await sdk.transfer(TO1, "0");
  } catch {
    failed = true;
  }

  assert.ok(failed, "Zero amount should fail");
  console.log("  zero amount ✓");
}

// Test 20.4: Test Invalid Recipient transfer
async function testInvalidRecipient() {
  let failed = false;

  try {
    await solidityPackedSha256.transfer("0x0000000000000000000000000000000000000000", "10");
  } catch {
    failed = true;
  }

  assert.ok(failed, "Invalid recipient should fail");
  console.log("  invalid recipient ✓");
}

// Test 20.5: Test Negative Amount transfer
async function testNegativeAmount() {
  let failed = false;

  try {
    await sdk.transfer(TO1, "-10");
  } catch {
    failed = true;
  }

  assert.ok(failed, "Negative amount should fail");
  console.log("  negative amount ✓");
}

// Test 20.5: Test Invalid Transfer Request
async function testMalformedRequest() {
  let failed = false;

  try {
    await sdk.transfer({});
  } catch {
    failed = true;
  }

  assert.ok(failed, "Malformed request should fail");
  console.log("  malformed request ✓");
}

async function run() {
  console.log("Test: ERC20 transactions");
  //await testTransferPositive();
  await testInsufficientBalance();
  await testZeroAmount();
  await testInvalidRecipient();
  await testNegativeAmount();
  await testMalformedRequest();
  console.log("✅ transaction tests passed\n");
}

run().catch(err => {
  console.error("❌ transaction test failed:", err.message);
  process.exit(1);
});
