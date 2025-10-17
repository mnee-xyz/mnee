import Mnee from '@mnee/ts-sdk';
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
  try {
    await mnee.balances([]);
    assert.fail('Should have thrown error for empty array');
  } catch (error) {
    assert(error !== undefined, 'Should throw error for empty array');
    assert(error.message === 'You must pass at least 1 valid address', 'Error message should indicate at least 1 valid address required');
    console.log(`  Empty array error properly caught: "${error.message}"`);
  }
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

// Test 3.4: Invalid address in array - should filter out invalid and return valid ones
async function testInvalidAddressInArray() {
  const addresses = [TEST_ADDRESS, testConfig.addresses.invalidAddress, EMPTY_ADDRESS];

  // Should return balances only for valid addresses
  const balances = await mnee.balances(addresses);
  
  assert(Array.isArray(balances), 'Balances should be an array');
  assert(balances.length === 2, 'Should return balances only for valid addresses (2 out of 3)');
  
  // Check that we got the correct addresses
  const returnedAddresses = balances.map(b => b.address);
  assert(returnedAddresses.includes(TEST_ADDRESS), 'Should include TEST_ADDRESS');
  assert(returnedAddresses.includes(EMPTY_ADDRESS), 'Should include EMPTY_ADDRESS');
  assert(!returnedAddresses.includes(testConfig.addresses.invalidAddress), 'Should not include invalid address');
  
  console.log(`  Filtered out invalid address, returned ${balances.length} valid addresses`);
}

// Test 3.5: Multiple invalid addresses - should throw error when no valid addresses
async function testMultipleInvalidAddresses() {
  const addresses = ['invalid1', 'invalid2', '12345'];

  try {
    await mnee.balances(addresses);
    assert.fail('Should have thrown error for all invalid addresses');
  } catch (error) {
    assert(error !== undefined, 'Should throw error when no valid addresses');
    assert(error.message === 'You must pass at least 1 valid address', 'Error message should indicate at least 1 valid address required');
    console.log(`  Error properly thrown when all addresses are invalid: "${error.message}"`);
  }
}

// Test 3.6: Mix of valid and invalid addresses - first invalid
async function testFirstInvalidAddress() {
  const addresses = [testConfig.addresses.invalidAddress, TEST_ADDRESS, EMPTY_ADDRESS];

  // Should still return balances for valid addresses even when first is invalid
  const balances = await mnee.balances(addresses);
  
  assert(Array.isArray(balances), 'Balances should be an array');
  assert(balances.length === 2, 'Should return balances only for valid addresses (2 out of 3)');
  
  // Check that we got the correct addresses
  const returnedAddresses = balances.map(b => b.address);
  assert(returnedAddresses.includes(TEST_ADDRESS), 'Should include TEST_ADDRESS');
  assert(returnedAddresses.includes(EMPTY_ADDRESS), 'Should include EMPTY_ADDRESS');
  assert(!returnedAddresses.includes(testConfig.addresses.invalidAddress), 'Should not include invalid address');
  
  console.log(`  First address was invalid but still returned ${balances.length} valid addresses`);
}

// Test 3.7: Mixed valid and invalid addresses - should return balances for valid addresses only
async function testMixedValidInvalidAddresses() {
  const addresses = [
    TEST_ADDRESS,                      // Valid address with balance
    '1HNuPi9Y7nMV6x8crJ6DnD1wJtkLym8EFE', // Valid address
    'another-invalid',                 // Invalid address
    EMPTY_ADDRESS,                     // Valid empty address
    '',                               // Invalid (empty string)
    'invalid-address-123'             // Invalid address
  ];

  console.log('  Test addresses:');
  addresses.forEach((addr, idx) => {
    console.log(`    [${idx}] ${addr || '(empty string)'}`);
  });

  const balances = await mnee.balances(addresses);
  
  // Should only return balances for valid addresses
  assert(Array.isArray(balances), 'Balances should be an array');
  assert(balances.length === 3, 'Should return balances only for valid addresses (3 out of 6)');
  
  // Check that we got the correct addresses
  const returnedAddresses = balances.map(b => b.address);
  assert(returnedAddresses.includes(TEST_ADDRESS), 'Should include TEST_ADDRESS');
  assert(returnedAddresses.includes(EMPTY_ADDRESS), 'Should include EMPTY_ADDRESS');
  assert(returnedAddresses.includes('1HNuPi9Y7nMV6x8crJ6DnD1wJtkLym8EFE'), 'Should include the other valid address');
  
  // Invalid addresses should not be in the results
  assert(!returnedAddresses.includes('another-invalid'), 'Should not include invalid addresses');
  assert(!returnedAddresses.includes(''), 'Should not include empty string');
  assert(!returnedAddresses.includes('invalid-address-123'), 'Should not include invalid addresses');

  console.log(`  Retrieved balances for ${balances.length} valid addresses (out of ${addresses.length} total):`);
  balances.forEach((balance) => {
    console.log(`    ${balance.address}: ${balance.decimalAmount} MNEE`);
  });
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

    console.log('Test 3.7: Mixed valid and invalid addresses');
    await testMixedValidInvalidAddresses();
    console.log('✅ Test 3.7 passed\n');

    console.log('All tests passed! ✅');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
