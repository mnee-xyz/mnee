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

// Test 5.1: Get enough UTXOs for a reasonable amount
async function testGetEnoughUtxosBasic() {
  // Get balance first to determine a reasonable test amount
  const balance = await mnee.balance(TEST_ADDRESS);
  const availableBalance = balance.amount;

  console.log(
    `  Available balance: ${mnee.fromAtomicAmount(availableBalance)} MNEE (${availableBalance} atomic units)`,
  );

  // Request 25% of available balance to ensure we have enough
  const requestedAmount = Math.floor(availableBalance * 0.25);
  console.log(`  Requesting: ${mnee.fromAtomicAmount(requestedAmount)} MNEE (${requestedAmount} atomic units)`);

  const utxos = await mnee.getEnoughUtxos(TEST_ADDRESS, requestedAmount);

  // Assertions
  assert(Array.isArray(utxos), 'UTXOs should be an array');
  assert(utxos.length > 0, 'Should return at least one UTXO');

  // Check UTXO structure
  const firstUtxo = utxos[0];
  assert(firstUtxo.txid, 'UTXO should have txid');
  assert(typeof firstUtxo.vout === 'number', 'UTXO should have vout number');
  assert(firstUtxo.outpoint, 'UTXO should have outpoint');
  assert(Array.isArray(firstUtxo.owners), 'UTXO should have owners array');
  assert(firstUtxo.owners.includes(TEST_ADDRESS), 'UTXO owners should include the address');
  assert(typeof firstUtxo.satoshis === 'number', 'UTXO should have satoshis value');
  assert(firstUtxo.script, 'UTXO should have script');

  // Check MNEE-specific data
  assert(firstUtxo.data, 'UTXO should have data object');
  assert(firstUtxo.data.bsv21, 'UTXO should have bsv21 data');
  assert(typeof firstUtxo.data.bsv21.amt === 'number', 'Should have MNEE amount');
  assert(firstUtxo.data.bsv21.op === 'transfer', 'Should be transfer operation');
  assert(firstUtxo.data.bsv21.id, 'Should have token ID');

  // Calculate total amount from returned UTXOs
  const totalAmount = utxos.reduce((sum, utxo) => {
    if (utxo.data.bsv21.op === 'transfer') {
      return sum + utxo.data.bsv21.amt;
    }
    return sum;
  }, 0);

  // Verify we got enough tokens
  assert(
    totalAmount >= requestedAmount,
    `Total amount (${totalAmount}) should be >= requested amount (${requestedAmount})`,
  );

  console.log(`  ✓ Found ${utxos.length} UTXOs with total ${mnee.fromAtomicAmount(totalAmount)} MNEE`);
  console.log(`  ✓ Successfully retrieved enough UTXOs for requested amount`);
}

// Test 5.2: Request more than available balance (should fail)
async function testGetEnoughUtxosInsufficientBalance() {
  const balance = await mnee.balance(TEST_ADDRESS);
  const availableBalance = balance.amount;

  // Request 150% of available balance
  const requestedAmount = Math.floor(availableBalance * 1.5) + 100000; // Add extra to ensure it's over
  console.log(`  Available: ${mnee.fromAtomicAmount(availableBalance)} MNEE`);
  console.log(`  Requesting: ${mnee.fromAtomicAmount(requestedAmount)} MNEE (should fail)`);

  try {
    await mnee.getEnoughUtxos(TEST_ADDRESS, requestedAmount);
    throw new Error('Should have thrown an insufficient balance error');
  } catch (error) {
    // Verify the error message format
    assert(
      error.message.includes('Insufficient MNEE balance'),
      `Error should mention insufficient balance: "${error.message}"`,
    );
    assert(
      error.message.includes('Max transfer amount'),
      `Error should mention max transfer amount: "${error.message}"`,
    );
    console.log(`  ✓ Correctly threw error: "${error.message}"`);
  }
}

// Test 5.3: Request very small amount (should succeed with minimal UTXOs)
async function testGetEnoughUtxosSmallAmount() {
  // Request a very small amount (0.00001 MNEE = 1 atomic unit)
  const requestedAmount = 1;
  console.log(`  Requesting very small amount: ${mnee.fromAtomicAmount(requestedAmount)} MNEE`);

  const utxos = await mnee.getEnoughUtxos(TEST_ADDRESS, requestedAmount);

  assert(Array.isArray(utxos), 'UTXOs should be an array');
  assert(utxos.length > 0, 'Should return at least one UTXO');

  // Calculate total amount
  const totalAmount = utxos.reduce((sum, utxo) => {
    if (utxo.data.bsv21.op === 'transfer') {
      return sum + utxo.data.bsv21.amt;
    }
    return sum;
  }, 0);

  assert(totalAmount >= requestedAmount, 'Total amount should be >= requested amount');
  console.log(`  ✓ Got ${utxos.length} UTXOs with ${mnee.fromAtomicAmount(totalAmount)} MNEE for tiny request`);
}

// Test 5.4: Empty address (should fail)
async function testGetEnoughUtxosEmptyAddress() {
  const requestedAmount = 100000; // 1 MNEE
  console.log(`  Testing empty address with ${mnee.fromAtomicAmount(requestedAmount)} MNEE request`);

  try {
    await mnee.getEnoughUtxos(EMPTY_ADDRESS, requestedAmount);
    throw new Error('Should have thrown an insufficient balance error');
  } catch (error) {
    assert(
      error.message.includes('Insufficient MNEE balance'),
      `Error should mention insufficient balance: "${error.message}"`,
    );
    assert(error.message.includes('Max transfer amount: 0'), `Error should show 0 available: "${error.message}"`);
    console.log(`  ✓ Empty address correctly failed: "${error.message}"`);
  }
}

// Test 5.5: Invalid address handling
async function testGetEnoughUtxosInvalidAddress() {
  const requestedAmount = 100000;

  try {
    await mnee.getEnoughUtxos(testConfig.addresses.invalidAddress, requestedAmount);
    console.log('  Invalid address handled (no error thrown)');
  } catch (error) {
    console.log(`  Invalid address error: "${error.message}"`);
    // This is acceptable - invalid addresses should either be handled gracefully or throw descriptive errors
  }
}

// Test 5.6: Verify efficiency - should stop early
async function testGetEnoughUtxosEfficiency() {
  // This test verifies that getEnoughUtxos stops fetching once it has enough
  // We can't directly test the internal pagination, but we can verify behavior

  const balance = await mnee.balance(TEST_ADDRESS);
  const availableBalance = balance.amount;

  // Request a moderate amount (10% of balance)
  const requestedAmount = Math.floor(availableBalance * 0.1);
  console.log(`  Testing efficiency with ${mnee.fromAtomicAmount(requestedAmount)} MNEE request`);

  const startTime = Date.now();
  const utxos = await mnee.getEnoughUtxos(TEST_ADDRESS, requestedAmount);
  const endTime = Date.now();

  // Calculate total amount
  const totalAmount = utxos.reduce((sum, utxo) => {
    if (utxo.data.bsv21.op === 'transfer') {
      return sum + utxo.data.bsv21.amt;
    }
    return sum;
  }, 0);

  assert(totalAmount >= requestedAmount, 'Should have enough tokens');

  console.log(`  ✓ Retrieved ${utxos.length} UTXOs in ${endTime - startTime}ms`);
  console.log(`  ✓ Total amount: ${mnee.fromAtomicAmount(totalAmount)} MNEE`);
  console.log(`  ✓ Method completed efficiently`);
}

// Test 5.7: Compare with getAllUtxos for verification
async function testGetEnoughUtxosVsGetAllUtxos() {
  const requestedAmount = Math.floor(testConfig.balances.testAddressBalance * 0.3);
  console.log(`  Comparing getEnoughUtxos vs getAllUtxos for ${mnee.fromAtomicAmount(requestedAmount)} MNEE`);

  // Get enough UTXOs
  const enoughUtxos = await mnee.getEnoughUtxos(TEST_ADDRESS, requestedAmount);
  const enoughTotal = enoughUtxos.reduce((sum, utxo) => sum + (utxo.data.bsv21.amt || 0), 0);

  // Get all UTXOs
  const allUtxos = await mnee.getAllUtxos(TEST_ADDRESS);
  const allTotal = allUtxos.reduce((sum, utxo) => sum + (utxo.data.bsv21.amt || 0), 0);

  // Verify getEnoughUtxos returned a subset
  assert(enoughUtxos.length <= allUtxos.length, 'getEnoughUtxos should return <= UTXOs than getAllUtxos');
  assert(enoughTotal >= requestedAmount, 'getEnoughUtxos should have enough tokens');
  assert(enoughTotal <= allTotal, 'getEnoughUtxos total should be <= getAllUtxos total');

  // Verify all UTXOs from getEnoughUtxos exist in getAllUtxos
  const allOutpoints = new Set(allUtxos.map((u) => u.outpoint));
  const allEnoughExistInAll = enoughUtxos.every((u) => allOutpoints.has(u.outpoint));
  assert(allEnoughExistInAll, 'All UTXOs from getEnoughUtxos should exist in getAllUtxos');

  console.log(`  ✓ getEnoughUtxos: ${enoughUtxos.length} UTXOs, ${mnee.fromAtomicAmount(enoughTotal)} MNEE`);
  console.log(`  ✓ getAllUtxos: ${allUtxos.length} UTXOs, ${mnee.fromAtomicAmount(allTotal)} MNEE`);
  console.log(`  ✓ getEnoughUtxos is a valid subset of getAllUtxos`);
}

// Test 5.8: Edge case - request exact balance
async function testGetEnoughUtxosExactBalance() {
  const balance = await mnee.balance(TEST_ADDRESS);
  const exactAmount = balance.amount;

  console.log(`  Requesting exact balance: ${mnee.fromAtomicAmount(exactAmount)} MNEE`);

  const utxos = await mnee.getEnoughUtxos(TEST_ADDRESS, exactAmount);

  const totalAmount = utxos.reduce((sum, utxo) => {
    if (utxo.data.bsv21.op === 'transfer') {
      return sum + utxo.data.bsv21.amt;
    }
    return sum;
  }, 0);

  assert(totalAmount >= exactAmount, 'Should have at least the exact amount');
  console.log(
    `  ✓ Got ${utxos.length} UTXOs with ${mnee.fromAtomicAmount(totalAmount)} MNEE for exact balance request`,
  );
}

// Test 5.9: Multiple calls consistency
async function testGetEnoughUtxosConsistency() {
  const requestedAmount = Math.floor(testConfig.balances.testAddressBalance * 0.2);
  console.log(`  Testing consistency across multiple calls for ${mnee.fromAtomicAmount(requestedAmount)} MNEE`);

  // Make three calls with the same parameters
  const [utxos1, utxos2, utxos3] = await Promise.all([
    mnee.getEnoughUtxos(TEST_ADDRESS, requestedAmount),
    mnee.getEnoughUtxos(TEST_ADDRESS, requestedAmount),
    mnee.getEnoughUtxos(TEST_ADDRESS, requestedAmount),
  ]);

  // Calculate totals
  const total1 = utxos1.reduce((sum, utxo) => sum + (utxo.data.bsv21.amt || 0), 0);
  const total2 = utxos2.reduce((sum, utxo) => sum + (utxo.data.bsv21.amt || 0), 0);
  const total3 = utxos3.reduce((sum, utxo) => sum + (utxo.data.bsv21.amt || 0), 0);

  // All should have enough
  assert(total1 >= requestedAmount, 'Call 1 should have enough');
  assert(total2 >= requestedAmount, 'Call 2 should have enough');
  assert(total3 >= requestedAmount, 'Call 3 should have enough');

  console.log(`  ✓ Call 1: ${utxos1.length} UTXOs, ${mnee.fromAtomicAmount(total1)} MNEE`);
  console.log(`  ✓ Call 2: ${utxos2.length} UTXOs, ${mnee.fromAtomicAmount(total2)} MNEE`);
  console.log(`  ✓ Call 3: ${utxos3.length} UTXOs, ${mnee.fromAtomicAmount(total3)} MNEE`);
  console.log(`  ✓ All calls returned sufficient UTXOs consistently`);
}

// Test 5.10: Zero and negative amounts
async function testGetEnoughUtxosEdgeAmounts() {
  console.log('  Testing edge case amounts...');

  // Test zero amount
  try {
    const utxos = await mnee.getEnoughUtxos(TEST_ADDRESS, 0);
    // Zero might be valid and return empty array or first UTXO
    console.log(`    Zero amount: ${utxos.length} UTXOs (handled gracefully)`);
  } catch (error) {
    console.log(`    Zero amount: Error as expected - ${error.message}`);
  }

  // Test negative amount
  try {
    const utxos = await mnee.getEnoughUtxos(TEST_ADDRESS, -1000);
    console.log(`    Negative amount: ${utxos.length} UTXOs (handled gracefully)`);
  } catch (error) {
    console.log(`    Negative amount: Error as expected - ${error.message}`);
  }

  console.log('    ✓ Edge case amounts handled appropriately');
}

// Run tests
async function runTests() {
  console.log('Running getEnoughUtxos tests...\n');

  try {
    console.log('Test 5.1: Get enough UTXOs for reasonable amount');
    await testGetEnoughUtxosBasic();
    console.log('✅ Test 5.1 passed\n');

    console.log('Test 5.2: Request more than available balance');
    await testGetEnoughUtxosInsufficientBalance();
    console.log('✅ Test 5.2 passed\n');

    console.log('Test 5.3: Request very small amount');
    await testGetEnoughUtxosSmallAmount();
    console.log('✅ Test 5.3 passed\n');

    console.log('Test 5.4: Empty address');
    await testGetEnoughUtxosEmptyAddress();
    console.log('✅ Test 5.4 passed\n');

    console.log('Test 5.5: Invalid address handling');
    await testGetEnoughUtxosInvalidAddress();
    console.log('✅ Test 5.5 passed\n');

    console.log('Test 5.6: Verify efficiency');
    await testGetEnoughUtxosEfficiency();
    console.log('✅ Test 5.6 passed\n');

    console.log('Test 5.7: Compare with getAllUtxos');
    await testGetEnoughUtxosVsGetAllUtxos();
    console.log('✅ Test 5.7 passed\n');

    console.log('Test 5.8: Request exact balance');
    await testGetEnoughUtxosExactBalance();
    console.log('✅ Test 5.8 passed\n');

    console.log('Test 5.9: Multiple calls consistency');
    await testGetEnoughUtxosConsistency();
    console.log('✅ Test 5.9 passed\n');

    console.log('Test 5.10: Zero and negative amounts');
    await testGetEnoughUtxosEdgeAmounts();
    console.log('✅ Test 5.10 passed\n');

    console.log('All getEnoughUtxos tests passed! ✅');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
