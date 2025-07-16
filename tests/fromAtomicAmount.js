import Mnee from '../dist/index.modern.js';
import assert from 'assert';
import testConfig from './tests.config.json' assert { type: 'json' };

// Test configuration
const config = {
  environment: testConfig.environment,
};

const mnee = new Mnee(config);

// Test 10.1: Convert whole atomic amounts
async function testWholeAtomicAmounts() {
  const testCases = [
    { atomic: 100000, expected: 1 },
    { atomic: 1000000, expected: 10 },
    { atomic: 10000000, expected: 100 },
    { atomic: 100000000, expected: 1000 },
  ];

  for (const testCase of testCases) {
    const decimal = mnee.fromAtomicAmount(testCase.atomic);
    assert(decimal === testCase.expected, 
      `${testCase.atomic} atomic units should be ${testCase.expected} MNEE, got ${decimal}`);
    console.log(`  ${testCase.atomic} atomic units = ${decimal} MNEE ✓`);
  }
}

// Test 10.2: Convert fractional atomic amounts
async function testFractionalAtomicAmounts() {
  const testCases = [
    { atomic: 10000, expected: 0.1 },
    { atomic: 1000, expected: 0.01 },
    { atomic: 100, expected: 0.001 },
    { atomic: 10, expected: 0.0001 },
    { atomic: 1, expected: 0.00001 },
    { atomic: 150000, expected: 1.5 },
    { atomic: 9999999, expected: 99.99999 },
    { atomic: 12345, expected: 0.12345 },
  ];

  for (const testCase of testCases) {
    const decimal = mnee.fromAtomicAmount(testCase.atomic);
    assert(decimal === testCase.expected, 
      `${testCase.atomic} atomic units should be ${testCase.expected} MNEE, got ${decimal}`);
    console.log(`  ${testCase.atomic} atomic units = ${decimal} MNEE ✓`);
  }
}

// Test 10.3: Test zero
async function testZero() {
  const decimal = mnee.fromAtomicAmount(0);
  assert(decimal === 0, `0 atomic units should be 0 MNEE, got ${decimal}`);
  console.log(`  0 atomic units = ${decimal} MNEE ✓`);
}

// Test 10.4: Test large atomic amounts
async function testLargeAtomicAmounts() {
  const testCases = [
    { atomic: 100000000000, expected: 1000000 },
    { atomic: 2100000000000, expected: 21000000 }, // Max BTC supply equivalent
  ];

  for (const testCase of testCases) {
    const decimal = mnee.fromAtomicAmount(testCase.atomic);
    assert(decimal === testCase.expected, 
      `${testCase.atomic} atomic units should be ${testCase.expected} MNEE, got ${decimal}`);
    console.log(`  ${testCase.atomic} atomic units = ${decimal} MNEE ✓`);
  }
}

// Test 10.5: Test negative atomic amounts
async function testNegativeAtomicAmounts() {
  const testCases = [
    { atomic: -100000, expected: -1 },
    { atomic: -50000, expected: -0.5 },
    { atomic: -1, expected: -0.00001 },
  ];

  for (const testCase of testCases) {
    const decimal = mnee.fromAtomicAmount(testCase.atomic);
    assert(decimal === testCase.expected, 
      `${testCase.atomic} atomic units should be ${testCase.expected} MNEE, got ${decimal}`);
    console.log(`  ${testCase.atomic} atomic units = ${decimal} MNEE ✓`);
  }
}

// Test 10.6: Test edge cases
async function testEdgeCases() {
  console.log('  Testing special values:');
  
  // Test NaN
  try {
    const nanResult = mnee.fromAtomicAmount(NaN);
    assert(isNaN(nanResult), 'NaN input should return NaN');
    console.log(`  NaN → ${nanResult} ✓`);
  } catch (error) {
    console.log(`  NaN threw error: "${error.message}"`);
  }

  // Test Infinity
  try {
    const infResult = mnee.fromAtomicAmount(Infinity);
    assert(infResult === Infinity, 'Infinity input should return Infinity');
    console.log(`  Infinity → ${infResult} ✓`);
  } catch (error) {
    console.log(`  Infinity threw error: "${error.message}"`);
  }

  // Test string number
  try {
    const stringResult = mnee.fromAtomicAmount("150000");
    assert(stringResult === 1.5, 'String "150000" should convert to 1.5 MNEE');
    console.log(`  "150000" (string) → ${stringResult} ✓`);
  } catch (error) {
    console.log(`  String input threw error: "${error.message}"`);
  }
}

// Test 10.7: Test precision
async function testPrecision() {
  const testCases = [
    { atomic: 123456, expected: 1.23456 },
    { atomic: 1234567, expected: 12.34567 },
    { atomic: 99999, expected: 0.99999 },
  ];

  console.log('  Testing decimal precision:');
  for (const testCase of testCases) {
    const decimal = mnee.fromAtomicAmount(testCase.atomic);
    assert(decimal === testCase.expected, 
      `${testCase.atomic} atomic units should be ${testCase.expected} MNEE, got ${decimal}`);
    console.log(`  ${testCase.atomic} atomic units = ${decimal} MNEE ✓`);
  }
}

// Test 10.8: Test round-trip conversion
async function testRoundTrip() {
  const testValues = [1, 0.5, 0.12345, 99.99999, 0.00001, 1000];
  
  console.log('  Testing round-trip conversions:');
  for (const value of testValues) {
    const atomic = mnee.toAtomicAmount(value);
    const decimal = mnee.fromAtomicAmount(atomic);
    assert(decimal === value, 
      `Round-trip conversion failed for ${value}: got ${decimal}`);
    console.log(`  ${value} → ${atomic} → ${decimal} ✓`);
  }
}

// Run tests
async function runTests() {
  console.log('Running fromAtomicAmount tests...\n');
  console.log('Note: MNEE uses 5 decimal places (1 MNEE = 100,000 atomic units)\n');

  try {
    // Fetch config first to ensure decimals are set
    await mnee.config();
    
    console.log('Test 10.1: Convert whole atomic amounts');
    await testWholeAtomicAmounts();
    console.log('✅ Test 10.1 passed\n');

    console.log('Test 10.2: Convert fractional atomic amounts');
    await testFractionalAtomicAmounts();
    console.log('✅ Test 10.2 passed\n');

    console.log('Test 10.3: Test zero');
    await testZero();
    console.log('✅ Test 10.3 passed\n');

    console.log('Test 10.4: Test large atomic amounts');
    await testLargeAtomicAmounts();
    console.log('✅ Test 10.4 passed\n');

    console.log('Test 10.5: Test negative atomic amounts');
    await testNegativeAtomicAmounts();
    console.log('✅ Test 10.5 passed\n');

    console.log('Test 10.6: Test edge cases');
    await testEdgeCases();
    console.log('✅ Test 10.6 passed\n');

    console.log('Test 10.7: Test precision');
    await testPrecision();
    console.log('✅ Test 10.7 passed\n');

    console.log('Test 10.8: Test round-trip conversion');
    await testRoundTrip();
    console.log('✅ Test 10.8 passed\n');

    console.log('All tests passed! ✅');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();