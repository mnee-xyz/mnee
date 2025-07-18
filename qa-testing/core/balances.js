import Mnee from 'mnee';
import assert from 'assert';
import testConfig from '../testConfig.js';

// Test configuration
const config = {
  environment: testConfig.environment,
  apiKey: testConfig.apiKey,
};

const mnee = new Mnee(config);

// Test addresses from config
const TEST_ADDRESS = testConfig.addresses.testAddress;
const EMPTY_ADDRESS = testConfig.addresses.emptyAddress;
const TEST_ADDRESS_TWO = '1ERN5r4A8Ur6T4XQgaxQLmWtRAmusga5xZ';
const TEST_ADDRESS_THREE = '159zQuZRmHUrZArYTFgogQxndrAeSsbTtJ';
const testAddressBalance = testConfig.balances.testAddressBalance;
const testAddressDecimalBalance = testConfig.balances.testAddressDecimalBalance;
const testAddressTwoBalance = testConfig.balances.testAddressTwoBalance;
const testAddressTwoDecimalBalance = testConfig.balances.testAddressTwoDecimalBalance;

// Test 3.1: Basic balances retrieval for multiple addresses
async function testBalances() {
  const addresses = [TEST_ADDRESS, EMPTY_ADDRESS, TEST_ADDRESS_TWO];
  const balances = await mnee.balances(addresses);

  // Assertions
  assert(Array.isArray(balances), 'Balances should be an array');
  assert(balances.length === addresses.length, 'Should return balance for each address');

  // Check first address (with balance)
  const firstBalance = balances[0];
  assert(firstBalance.address === TEST_ADDRESS, 'First balance address should match');
  assert(firstBalance.amount === testAddressBalance, 'First address should have expected balance');
  assert(firstBalance.decimalAmount === testAddressDecimalBalance, 'First address decimal amount should match');

  // Check second address (empty)
  const secondBalance = balances[1];
  assert(secondBalance.address === EMPTY_ADDRESS, 'Second balance address should match');
  assert(secondBalance.amount === 0, 'Second address should have zero balance');
  assert(secondBalance.decimalAmount === 0, 'Second address decimal amount should be zero');

  // Check third address (with balance)
  const thirdBalance = balances[2];
  assert(thirdBalance.address === TEST_ADDRESS_TWO, 'Third balance address should match');
  assert(thirdBalance.amount === testAddressTwoBalance, 'Third address should have expected balance');
  assert(thirdBalance.decimalAmount === testAddressTwoDecimalBalance, 'Third address decimal amount should match');

  // Display results
  console.log(`  Retrieved balances for ${balances.length} addresses:`);
  balances.forEach((balance) => {
    console.log(`    ${balance.address}: ${balance.decimalAmount} MNEE (${balance.amount} atomic)`);
  });
}

// Test 3.2: Empty array handling
async function testEmptyArray() {
  const balances = await mnee.balances([]);

  assert(Array.isArray(balances), 'Should return empty array');
  assert(balances.length === 0, 'Should return empty array for empty input');

  console.log('  Empty array handled correctly');
}

// Test 3.3: Large batch of addresses
async function testLargeBatch() {
  // Create array with test address repeated and some variations
  const addresses = [
    TEST_ADDRESS,
    EMPTY_ADDRESS,
    TEST_ADDRESS_TWO, // Random valid address
    TEST_ADDRESS_THREE, // Another random valid address
    TEST_ADDRESS, // Duplicate to test handling
  ];

  const balances = await mnee.balances(addresses);

  assert(Array.isArray(balances), 'Balances should be an array');
  assert(balances.length === addresses.length, 'Should return balance for each address');

  // Check that duplicate addresses are handled
  const testAddressBalances = balances.filter((b) => b.address === TEST_ADDRESS);
  assert(testAddressBalances.length === 2, 'Should handle duplicate addresses');
  assert(
    testAddressBalances.every((b) => b.amount === testAddressBalance),
    'Duplicate addresses should have same balance',
  );

  console.log(`  Large batch processed: ${balances.length} addresses`);
}

// Test 3.4: Invalid address in array
async function testInvalidAddressInArray() {
  const addresses = [TEST_ADDRESS, testConfig.addresses.invalidAddress, EMPTY_ADDRESS];

  try {
    await mnee.balances(addresses);
    assert.fail('Should have thrown error for invalid address in array');
  } catch (error) {
    // The SDK now properly validates all addresses before making API calls
    assert(error !== undefined, 'Should throw error for invalid address');
    // Check if it's the assert.fail error
    if (error.message === 'Should have thrown error for invalid address in array') {
      throw error;
    }
    // Otherwise it's the expected validation error
    console.log(`  Error properly thrown for invalid address in array: "${error.message}"`);
  }
}

// Test 3.5: Multiple invalid addresses
async function testMultipleInvalidAddresses() {
  const addresses = ['invalid1', 'invalid2', '12345'];

  try {
    await mnee.balances(addresses);
    assert.fail('Should have thrown error for invalid addresses');
  } catch (error) {
    assert(error !== undefined, 'Should throw error for invalid addresses');
    // Check if it's the assert.fail error
    if (error.message === 'Should have thrown error for invalid addresses') {
      throw error;
    }
    console.log(`  Error properly thrown for multiple invalid addresses: "${error.message}"`);
  }
}

// Test 3.6: Mix of valid and invalid addresses - first invalid
async function testFirstInvalidAddress() {
  const addresses = [testConfig.addresses.invalidAddress, TEST_ADDRESS, EMPTY_ADDRESS];

  try {
    await mnee.balances(addresses);
    assert.fail('Should have thrown error when first address is invalid');
  } catch (error) {
    assert(error !== undefined, 'Should throw error for invalid address');
    // Check if it's the assert.fail error
    if (error.message === 'Should have thrown error when first address is invalid') {
      throw error;
    }
    console.log(`  Error properly thrown when first address is invalid: "${error.message}"`);
  }
}

// Run tests
async function runTests() {
  console.log('Running balances tests...\n');

  try {
    console.log('Test 3.1: Basic balances retrieval');
    await testBalances();
    console.log('✅ Test 3.1 passed\n');

    console.log('Test 3.2: Empty array handling');
    await testEmptyArray();
    console.log('✅ Test 3.2 passed\n');

    console.log('Test 3.3: Large batch of addresses');
    await testLargeBatch();
    console.log('✅ Test 3.3 passed\n');

    console.log('Test 3.4: Invalid address in array');
    await testInvalidAddressInArray();
    console.log('✅ Test 3.4 passed\n');

    console.log('Test 3.5: Multiple invalid addresses');
    await testMultipleInvalidAddresses();
    console.log('✅ Test 3.5 passed\n');

    console.log('Test 3.6: First address invalid');
    await testFirstInvalidAddress();
    console.log('✅ Test 3.6 passed\n');

    console.log('All tests passed! ✅');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
