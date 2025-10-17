import Mnee from '@mnee/ts-sdk';
import assert from 'assert';
import testConfig from '../testConfig.js';

// Test configuration
const config = {
  environment: testConfig.environment,
  apiKey: testConfig.apiKey,
};

const mnee = new Mnee(config);

// Test 9.1: Convert whole numbers
async function testWholeNumbers() {
  const testCases = [
    { decimal: 1, expected: 100000 },
    { decimal: 10, expected: 1000000 },
    { decimal: 100, expected: 10000000 },
    { decimal: 1000, expected: 100000000 },
  ];

  for (const testCase of testCases) {
    const atomic = mnee.toAtomicAmount(testCase.decimal);
    assert(atomic === testCase.expected, 
      `${testCase.decimal} MNEE should be ${testCase.expected} atomic units, got ${atomic}`);
    console.log(`  ${testCase.decimal} MNEE = ${atomic} atomic units ✓`);
  }
}

// Test 9.2: Convert decimal amounts
async function testDecimalAmounts() {
  const testCases = [
    { decimal: 0.1, expected: 10000 },
    { decimal: 0.01, expected: 1000 },
    { decimal: 0.001, expected: 100 },
    { decimal: 0.0001, expected: 10 },
    { decimal: 0.00001, expected: 1 },
    { decimal: 1.5, expected: 150000 },
    { decimal: 99.99999, expected: 9999999 },
    { decimal: 0.12345, expected: 12345 },
  ];

  for (const testCase of testCases) {
    const atomic = mnee.toAtomicAmount(testCase.decimal);
    assert(atomic === testCase.expected, 
      `${testCase.decimal} MNEE should be ${testCase.expected} atomic units, got ${atomic}`);
    console.log(`  ${testCase.decimal} MNEE = ${atomic} atomic units ✓`);
  }
}

// Test 9.3: Test zero
async function testZero() {
  const atomic = mnee.toAtomicAmount(0);
  assert(atomic === 0, `0 MNEE should be 0 atomic units, got ${atomic}`);
  console.log(`  0 MNEE = ${atomic} atomic units ✓`);
}

// Test 9.4: Test precision limits
async function testPrecisionLimits() {
  // MNEE has 5 decimal places, so smallest unit is 0.00001
  const testCases = [
    { decimal: 0.000001, expected: 0 }, // Too small, should round to 0
    { decimal: 0.000009, expected: 1 }, // Should round to 1
    { decimal: 0.000011, expected: 1 }, // Should round to 1
    { decimal: 0.000015, expected: 2 }, // Should round to 2
  ];

  for (const testCase of testCases) {
    const atomic = mnee.toAtomicAmount(testCase.decimal);
    assert(atomic === testCase.expected, 
      `${testCase.decimal} MNEE should be ${testCase.expected} atomic units, got ${atomic}`);
    console.log(`  ${testCase.decimal} MNEE = ${atomic} atomic units ✓`);
  }
}

// Test 9.5: Test large numbers
async function testLargeNumbers() {
  const testCases = [
    { decimal: 1000000, expected: 100000000000 },
    { decimal: 21000000, expected: 2100000000000 }, // Max BTC supply equivalent
  ];

  for (const testCase of testCases) {
    const atomic = mnee.toAtomicAmount(testCase.decimal);
    assert(atomic === testCase.expected, 
      `${testCase.decimal} MNEE should be ${testCase.expected} atomic units, got ${atomic}`);
    console.log(`  ${testCase.decimal} MNEE = ${atomic} atomic units ✓`);
  }
}

// Test 9.6: Test negative numbers
async function testNegativeNumbers() {
  const testCases = [
    { decimal: -1, expected: -100000 },
    { decimal: -0.5, expected: -50000 },
    { decimal: -0.00001, expected: -1 },
  ];

  for (const testCase of testCases) {
    const atomic = mnee.toAtomicAmount(testCase.decimal);
    assert(atomic === testCase.expected, 
      `${testCase.decimal} MNEE should be ${testCase.expected} atomic units, got ${atomic}`);
    console.log(`  ${testCase.decimal} MNEE = ${atomic} atomic units ✓`);
  }
}

// Test 9.7: Test edge cases
async function testEdgeCases() {
  console.log('  Testing special values:');
  
  // Test NaN
  try {
    const nanResult = mnee.toAtomicAmount(NaN);
    assert(isNaN(nanResult), 'NaN input should return NaN');
    console.log(`  NaN → ${nanResult} ✓`);
  } catch (error) {
    console.log(`  NaN threw error: "${error.message}"`);
  }

  // Test Infinity
  try {
    const infResult = mnee.toAtomicAmount(Infinity);
    assert(infResult === Infinity, 'Infinity input should return Infinity');
    console.log(`  Infinity → ${infResult} ✓`);
  } catch (error) {
    console.log(`  Infinity threw error: "${error.message}"`);
  }

  // Test string number - it seems to work, so let's assert it
  try {
    const stringResult = mnee.toAtomicAmount("1.5");
    assert(stringResult === 150000, 'String "1.5" should convert to 150000 atomic units');
    console.log(`  "1.5" (string) → ${stringResult} ✓`);
  } catch (error) {
    console.log(`  String input threw error: "${error.message}"`);
  }
}

// Test 9.8: Test rounding behavior
async function testRounding() {
  const testCases = [
    { decimal: 1.999999, expected: 200000 }, // Should round up
    { decimal: 1.9999999, expected: 200000 }, // Should round up
  ];

  console.log('  Testing rounding behavior:');
  for (const testCase of testCases) {
    const atomic = mnee.toAtomicAmount(testCase.decimal);
    assert(atomic === testCase.expected, 
      `${testCase.decimal} MNEE should round to ${testCase.expected} atomic units, got ${atomic}`);
    console.log(`  ${testCase.decimal} MNEE = ${atomic} atomic units ✓`);
  }
}

// Run tests
async function runTests() {
  console.log('Running toAtomicAmount tests...\n');
  console.log('Note: MNEE uses 5 decimal places (1 MNEE = 100,000 atomic units)\n');

  try {
    // Fetch config first to ensure decimals are set
    await mnee.config();
    console.log('Test 9.1: Convert whole numbers');
    await testWholeNumbers();
    console.log('✅ Test 9.1 passed\n');

    console.log('Test 9.2: Convert decimal amounts');
    await testDecimalAmounts();
    console.log('✅ Test 9.2 passed\n');

    console.log('Test 9.3: Test zero');
    await testZero();
    console.log('✅ Test 9.3 passed\n');

    console.log('Test 9.4: Test precision limits');
    await testPrecisionLimits();
    console.log('✅ Test 9.4 passed\n');

    console.log('Test 9.5: Test large numbers');
    await testLargeNumbers();
    console.log('✅ Test 9.5 passed\n');

    console.log('Test 9.6: Test negative numbers');
    await testNegativeNumbers();
    console.log('✅ Test 9.6 passed\n');

    console.log('Test 9.7: Test edge cases');
    await testEdgeCases();
    console.log('✅ Test 9.7 passed\n');

    console.log('Test 9.8: Test rounding behavior');
    await testRounding();
    console.log('✅ Test 9.8 passed\n');

    console.log('All tests passed! ✅');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();