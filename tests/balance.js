import Mnee from '../dist/index.modern.js';
import assert from 'assert';
import testConfig from './tests.config.json' assert { type: 'json' };

// Test configuration
const config = {
  environment: testConfig.environment,
};

const mnee = new Mnee(config);

// Test address from config
const TEST_ADDRESS = testConfig.addresses.testAddress;

// Test 2.1: Basic balance retrieval
async function testBalance() {
  const balance = await mnee.balance(TEST_ADDRESS);

  // Assertions
  assert(balance !== undefined, 'Balance should not be undefined');
  assert(typeof balance.address === 'string', 'Balance should have address property');
  assert(balance.address === TEST_ADDRESS, 'Balance address should match requested address');
  assert(typeof balance.amount === 'number', 'Balance should have amount property');
  assert(typeof balance.decimalAmount === 'number', 'Balance should have decimalAmount property');
  assert(balance.amount >= 0, 'Balance amount should be non-negative');
  assert(balance.decimalAmount >= 0, 'Decimal amount should be non-negative');

  // Display balance details
  console.log(`  Address: ${balance.address}`);
  console.log(`  MNEE Balance (atomic): ${balance.amount}`);
  console.log(`  MNEE Balance (decimal): ${balance.decimalAmount}`);
}

// Test 2.2: Balance for non-existent address
async function testEmptyBalance() {
  // Use empty address from config
  const emptyAddress = testConfig.addresses.emptyAddress;
  const balance = await mnee.balance(emptyAddress);

  // Assertions
  assert(balance !== undefined, 'Balance should not be undefined even for empty address');
  assert(balance.address === emptyAddress, 'Balance address should match requested address');
  assert(balance.amount === 0, 'Empty address should have 0 balance');
  assert(balance.decimalAmount === 0, 'Empty address should have 0 decimal balance');

  console.log(`  Empty address balance verified: ${balance.amount}`);
}

// Test 2.3: Invalid address handling
async function testInvalidAddress() {
  try {
    await mnee.balance(testConfig.addresses.invalidAddress);
    assert.fail('Should have thrown error for invalid address');
  } catch (error) {
    // The SDK now properly throws an error for invalid addresses
    assert(error !== undefined, 'Should throw error for invalid address');
    assert(error.message.includes('Invalid Bitcoin address'), 'Error message should indicate invalid address');
    console.log(`  Invalid address error properly caught: "${error.message}"`);
  }
}

// Run tests
async function runTests() {
  console.log('Running balance tests...\n');

  try {
    console.log('Test 2.1: Basic balance retrieval');
    await testBalance();
    console.log('✅ Test 2.1 passed\n');

    console.log('Test 2.2: Balance for empty address');
    await testEmptyBalance();
    console.log('✅ Test 2.2 passed\n');

    console.log('Test 2.3: Invalid address handling');
    await testInvalidAddress();
    console.log('✅ Test 2.3 passed\n');

    console.log('All tests passed! ✅');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
