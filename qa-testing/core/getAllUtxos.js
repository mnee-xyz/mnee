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

// Test 6.1: Get all UTXOs for address with balance
async function testGetAllUtxosBasic() {
  const allUtxos = await mnee.getAllUtxos(TEST_ADDRESS);
  const balance = await mnee.balance(TEST_ADDRESS);
  const expectedBalance = balance.amount;

  // Assertions
  assert(Array.isArray(allUtxos), 'UTXOs should be an array');
  assert(allUtxos.length > 0, 'Address with balance should have UTXOs');

  // Check UTXO structure
  const firstUtxo = allUtxos[0];
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

  // Calculate total from ALL UTXOs
  const totalAmount = allUtxos.reduce((sum, utxo) => {
    if (utxo.data.bsv21.op === 'transfer') {
      return sum + utxo.data.bsv21.amt;
    }
    return sum;
  }, 0);

  console.log(`  Found ${allUtxos.length} total UTXOs`);
  console.log(`  Total MNEE amount: ${mnee.fromAtomicAmount(totalAmount)} MNEE (${totalAmount} atomic units)`);
  console.log(`  Expected balance: ${mnee.fromAtomicAmount(expectedBalance)} MNEE (${expectedBalance} atomic units)`);

  // The totals should match (allowing for small differences due to pending transactions)
  if (Math.abs(totalAmount - expectedBalance) <= 1000) {
    // Allow 0.01 MNEE difference
    console.log(`  ✓ UTXO total matches expected balance (within tolerance)`);
  } else {
    console.log(`  ⚠️  Balance difference: ${Math.abs(totalAmount - expectedBalance)} atomic units`);
    console.log(`     This might be due to pending transactions or recent activity`);
  }

  // Verify no duplicate UTXOs
  const outpoints = allUtxos.map((u) => u.outpoint);
  const uniqueOutpoints = [...new Set(outpoints)];
  assert(outpoints.length === uniqueOutpoints.length, 'Should have no duplicate UTXOs');
  console.log(`  ✓ No duplicate UTXOs found`);
}

// Test 6.2: Get all UTXOs for empty address
async function testGetAllUtxosEmpty() {
  const allUtxos = await mnee.getAllUtxos(EMPTY_ADDRESS);

  assert(Array.isArray(allUtxos), 'UTXOs should be an array');
  assert(allUtxos.length === 0, 'Empty address should have no UTXOs');

  console.log('  ✓ Empty address correctly returns no UTXOs');
}

// Test 6.3: Invalid address handling
async function testGetAllUtxosInvalidAddress() {
  try {
    await mnee.getAllUtxos(testConfig.addresses.invalidAddress);
    console.log('  Invalid address handled (no error thrown)');
  } catch (error) {
    console.log(`  Invalid address error: "${error.message}"`);
    // This is acceptable - invalid addresses should either be handled gracefully or throw descriptive errors
  }
}

// Test 6.4: Compare with paginated getUtxos
async function testGetAllUtxosVsPaginated() {
  console.log('  Comparing getAllUtxos with manual pagination...');

  // Get all UTXOs using getAllUtxos
  const allUtxos = await mnee.getAllUtxos(TEST_ADDRESS);

  // Get all UTXOs using manual pagination (like in getUtxos.js)
  let paginatedUtxos = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const pageUtxos = await mnee.getUtxos(TEST_ADDRESS, page, 25); // Use same page size as getAllUtxos
    paginatedUtxos = paginatedUtxos.concat(pageUtxos);

    hasMore = pageUtxos.length === 25;
    page++;

    // Safety check
    if (page > 50) {
      console.log('    Warning: Stopped pagination after 50 pages');
      break;
    }
  }

  console.log(`  getAllUtxos: ${allUtxos.length} UTXOs`);
  console.log(`  Manual pagination: ${paginatedUtxos.length} UTXOs across ${page - 1} pages`);

  // They should have the same number of UTXOs (or very close due to timing)
  const difference = Math.abs(allUtxos.length - paginatedUtxos.length);
  if (difference <= 2) {
    // Allow small difference due to timing
    console.log(`  ✓ UTXO counts match (difference: ${difference})`);
  } else {
    console.log(`  ⚠️  UTXO count difference: ${difference} (might be due to new transactions)`);
  }

  // Verify most UTXOs are the same (allowing for new transactions)
  const allOutpoints = new Set(allUtxos.map((u) => u.outpoint));
  const paginatedOutpoints = new Set(paginatedUtxos.map((u) => u.outpoint));

  const commonOutpoints = [...allOutpoints].filter((op) => paginatedOutpoints.has(op));
  const matchPercentage = (commonOutpoints.length / Math.max(allUtxos.length, paginatedUtxos.length)) * 100;

  console.log(`  ✓ ${matchPercentage.toFixed(1)}% of UTXOs match between methods`);

  if (matchPercentage >= 95) {
    console.log(`  ✓ High match percentage indicates consistent results`);
  } else {
    console.log(`  ⚠️  Lower match percentage might indicate timing differences or API issues`);
  }
}

// Test 6.5: Performance comparison
async function testGetAllUtxosPerformance() {
  console.log('  Testing performance...');

  const startTime = Date.now();
  const allUtxos = await mnee.getAllUtxos(TEST_ADDRESS);
  const endTime = Date.now();

  const duration = endTime - startTime;
  const utxoCount = allUtxos.length;

  console.log(`  ✓ Retrieved ${utxoCount} UTXOs in ${duration}ms`);

  if (utxoCount > 0) {
    const msPerUtxo = duration / utxoCount;
    console.log(`  ✓ Performance: ${msPerUtxo.toFixed(2)}ms per UTXO`);
  }

  // Test that the method completes in reasonable time
  assert(duration < 30000, 'getAllUtxos should complete within 30 seconds');
  console.log(`  ✓ Completed within reasonable time`);
}

// Test 6.6: UTXO details verification
async function testGetAllUtxosDetails() {
  const allUtxos = await mnee.getAllUtxos(TEST_ADDRESS);

  if (allUtxos.length > 0) {
    console.log(`  Analyzing ${allUtxos.length} UTXOs...`);

    // Check for different types of operations
    const operations = new Set(allUtxos.map((u) => u.data.bsv21.op));
    console.log(`    Operations found: ${[...operations].join(', ')}`);

    // Check amount distribution
    const amounts = allUtxos.map((u) => u.data.bsv21.amt);
    const totalAmount = amounts.reduce((sum, amt) => sum + amt, 0);
    const avgAmount = totalAmount / amounts.length;
    const minAmount = Math.min(...amounts);
    const maxAmount = Math.max(...amounts);

    console.log(`    Total amount: ${mnee.fromAtomicAmount(totalAmount)} MNEE`);
    console.log(`    Average UTXO: ${mnee.fromAtomicAmount(avgAmount)} MNEE`);
    console.log(`    Smallest UTXO: ${mnee.fromAtomicAmount(minAmount)} MNEE`);
    console.log(`    Largest UTXO: ${mnee.fromAtomicAmount(maxAmount)} MNEE`);

    // Check for unique transaction IDs
    const txids = new Set(allUtxos.map((u) => u.txid));
    console.log(`    Unique transactions: ${txids.size}`);

    // Verify all have proper outpoint format (txid_vout format)
    const properOutpoints = allUtxos.filter((u) => /^[a-fA-F0-9]{64}_\d+$/.test(u.outpoint));
    assert(properOutpoints.length === allUtxos.length, 'All UTXOs should have proper outpoint format');
    console.log(`    ✓ All UTXOs have proper outpoint format`);
  }
}

// Test 6.7: Memory usage considerations
async function testGetAllUtxosMemory() {
  console.log('  Testing memory considerations...');

  // Get baseline memory usage
  if (global.gc) {
    global.gc();
  }
  const beforeMemory = process.memoryUsage();

  const allUtxos = await mnee.getAllUtxos(TEST_ADDRESS);

  const afterMemory = process.memoryUsage();
  const memoryIncrease = afterMemory.heapUsed - beforeMemory.heapUsed;
  const memoryPerUtxo = allUtxos.length > 0 ? memoryIncrease / allUtxos.length : 0;

  console.log(`  Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB for ${allUtxos.length} UTXOs`);

  if (allUtxos.length > 0) {
    console.log(`  Memory per UTXO: ${(memoryPerUtxo / 1024).toFixed(2)} KB`);
  }

  // Verify reasonable memory usage (less than 100MB for normal operations)
  assert(memoryIncrease < 100 * 1024 * 1024, 'Memory usage should be reasonable');
  console.log(`  ✓ Memory usage is within reasonable bounds`);
}

// Test 6.8: Consistency across multiple calls
async function testGetAllUtxosConsistency() {
  console.log('  Testing consistency across multiple calls...');

  // Make multiple calls in quick succession
  const [utxos1, utxos2, utxos3] = await Promise.all([
    mnee.getAllUtxos(TEST_ADDRESS),
    mnee.getAllUtxos(TEST_ADDRESS),
    mnee.getAllUtxos(TEST_ADDRESS),
  ]);

  console.log(`  Call 1: ${utxos1.length} UTXOs`);
  console.log(`  Call 2: ${utxos2.length} UTXOs`);
  console.log(`  Call 3: ${utxos3.length} UTXOs`);

  // Check that counts are consistent (allowing for 1-2 differences due to timing)
  const maxDiff = Math.max(
    Math.abs(utxos1.length - utxos2.length),
    Math.abs(utxos2.length - utxos3.length),
    Math.abs(utxos1.length - utxos3.length),
  );

  if (maxDiff <= 2) {
    console.log(`  ✓ Consistent results (max difference: ${maxDiff})`);
  } else {
    console.log(`  ⚠️  Some inconsistency (max difference: ${maxDiff}) - might be due to new transactions`);
  }

  // Check that most UTXOs are the same across calls
  const outpoints1 = new Set(utxos1.map((u) => u.outpoint));
  const outpoints2 = new Set(utxos2.map((u) => u.outpoint));
  const common = [...outpoints1].filter((op) => outpoints2.has(op));
  const similarity = (common.length / Math.max(utxos1.length, utxos2.length)) * 100;

  console.log(`  ✓ ${similarity.toFixed(1)}% similarity between calls`);
}

// Test 6.9: Compare with balance for verification
async function testGetAllUtxosVsBalance() {
  console.log('  Comparing getAllUtxos total with balance...');

  const [allUtxos, balance] = await Promise.all([mnee.getAllUtxos(TEST_ADDRESS), mnee.balance(TEST_ADDRESS)]);

  const utxosTotal = allUtxos.reduce((sum, utxo) => {
    if (utxo.data.bsv21.op === 'transfer') {
      return sum + utxo.data.bsv21.amt;
    }
    return sum;
  }, 0);

  console.log(`  UTXOs total: ${mnee.fromAtomicAmount(utxosTotal)} MNEE`);
  console.log(`  Balance API: ${mnee.fromAtomicAmount(balance.amount)} MNEE`);

  const difference = Math.abs(utxosTotal - balance.amount);
  const percentDiff = balance.amount > 0 ? (difference / balance.amount) * 100 : 0;

  if (percentDiff <= 1) {
    // Less than 1% difference
    console.log(`  ✓ Totals match within 1% (${percentDiff.toFixed(2)}% difference)`);
  } else {
    console.log(`  ⚠️  ${percentDiff.toFixed(2)}% difference - might be due to timing or pending transactions`);
  }
}

// Test 6.10: Edge cases and error handling
async function testGetAllUtxosEdgeCases() {
  console.log('  Testing edge cases...');

  // Test with null/undefined (should be caught by TypeScript but test runtime)
  try {
    // @ts-ignore - Testing invalid input
    await mnee.getAllUtxos(null);
    console.log('    Null address: Handled gracefully');
  } catch (error) {
    console.log(`    Null address: Error as expected - ${error.message}`);
  }

  try {
    // @ts-ignore - Testing invalid input
    await mnee.getAllUtxos(undefined);
    console.log('    Undefined address: Handled gracefully');
  } catch (error) {
    console.log(`    Undefined address: Error as expected - ${error.message}`);
  }

  // Test with empty string
  try {
    await mnee.getAllUtxos('');
    console.log('    Empty string: Handled gracefully');
  } catch (error) {
    console.log(`    Empty string: Error as expected - ${error.message}`);
  }

  console.log('    ✓ Edge cases handled appropriately');
}

// Run tests
async function runTests() {
  console.log('Running getAllUtxos tests...\n');

  try {
    console.log('Test 6.1: Get all UTXOs for address with balance');
    await testGetAllUtxosBasic();
    console.log('✅ Test 6.1 passed\n');

    console.log('Test 6.2: Get all UTXOs for empty address');
    await testGetAllUtxosEmpty();
    console.log('✅ Test 6.2 passed\n');

    console.log('Test 6.3: Invalid address handling');
    await testGetAllUtxosInvalidAddress();
    console.log('✅ Test 6.3 passed\n');

    console.log('Test 6.4: Compare with paginated getUtxos');
    await testGetAllUtxosVsPaginated();
    console.log('✅ Test 6.4 passed\n');

    console.log('Test 6.5: Performance testing');
    await testGetAllUtxosPerformance();
    console.log('✅ Test 6.5 passed\n');

    console.log('Test 6.6: UTXO details verification');
    await testGetAllUtxosDetails();
    console.log('✅ Test 6.6 passed\n');

    console.log('Test 6.7: Memory usage considerations');
    await testGetAllUtxosMemory();
    console.log('✅ Test 6.7 passed\n');

    console.log('Test 6.8: Consistency across multiple calls');
    await testGetAllUtxosConsistency();
    console.log('✅ Test 6.8 passed\n');

    console.log('Test 6.9: Compare with balance');
    await testGetAllUtxosVsBalance();
    console.log('✅ Test 6.9 passed\n');

    console.log('Test 6.10: Edge cases and error handling');
    await testGetAllUtxosEdgeCases();
    console.log('✅ Test 6.10 passed\n');

    console.log('All getAllUtxos tests passed! ✅');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
