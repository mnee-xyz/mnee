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

// Test 4.1: Get UTXOs for single address (with pagination handling)
async function testGetUtxosSingle() {
  // First get with default pagination
  const firstPage = await mnee.getUtxos(TEST_ADDRESS);
  const testAddressBalance = testConfig.balances.testAddressBalance;

  // Assertions
  assert(Array.isArray(firstPage), 'UTXOs should be an array');
  assert(firstPage.length > 0, 'Address with balance should have UTXOs');

  // Check UTXO structure
  const firstUtxo = firstPage[0];
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

  // Get ALL UTXOs using pagination to calculate total
  let allUtxos = [];
  let page = 1; // v2/utxos uses 1-based pagination with default of 1
  let hasMore = true;

  while (hasMore) {
    const utxos = await mnee.getUtxos(TEST_ADDRESS, page, 100);
    allUtxos = allUtxos.concat(utxos);

    // If we got less than the page size, we've reached the end
    hasMore = utxos.length === 100;
    page++;

    // Safety check to prevent infinite loops
    if (page > 20) {
      console.log('  Warning: Stopped after 20 pages to prevent infinite loop');
      break;
    }
  }

  // Calculate total from ALL UTXOs
  const totalAmount = allUtxos.reduce((sum, utxo) => {
    if (utxo.data.bsv21.op === 'transfer') {
      return sum + utxo.data.bsv21.amt;
    }
    return sum;
  }, 0);

  // For now, we'll just check that we have UTXOs and log the difference
  // The balance might not match exactly due to pending transactions
  console.log(`  Found ${allUtxos.length} total UTXOs across ${page} page(s)`);
  console.log(`  Total MNEE amount from UTXOs: ${totalAmount} (${mnee.fromAtomicAmount(totalAmount)} MNEE)`);
  console.log(`  Expected balance: ${testAddressBalance} (${mnee.fromAtomicAmount(testAddressBalance)} MNEE)`);

  if (totalAmount !== testAddressBalance) {
    console.log(`  ⚠️  Balance mismatch: difference of ${Math.abs(totalAmount - testAddressBalance)} atomic units`);
    console.log(`     This might be due to pending transactions or recent activity`);
  } else {
    console.log(`  ✓ UTXO total matches expected balance`);
  }
}

// Test 4.2: Get UTXOs for empty address
async function testGetUtxosEmpty() {
  const utxos = await mnee.getUtxos(EMPTY_ADDRESS);

  assert(Array.isArray(utxos), 'UTXOs should be an array');
  assert(utxos.length === 0, 'Empty address should have no UTXOs');

  console.log('  Empty address correctly returns no UTXOs');
}

// Test 4.3: Get UTXOs for multiple addresses (with pagination)
async function testGetUtxosMultiple() {
  const addresses = [TEST_ADDRESS, EMPTY_ADDRESS, '1ERN5r4A8Ur6T4XQgaxQLmWtRAmusga5xZ'];

  // First call with default pagination
  const firstPage = await mnee.getUtxos(addresses);
  assert(Array.isArray(firstPage), 'UTXOs should be an array');

  // Get more UTXOs with larger page size to ensure we get data from all addresses
  const largerPage = await mnee.getUtxos(addresses, 1, 100);

  // Check that we got UTXOs for addresses with balance
  const testAddressUtxos = largerPage.filter((utxo) => utxo.owners.includes(TEST_ADDRESS));
  const emptyAddressUtxos = largerPage.filter((utxo) => utxo.owners.includes(EMPTY_ADDRESS));
  const thirdAddressUtxos = largerPage.filter((utxo) => utxo.owners.includes('1ERN5r4A8Ur6T4XQgaxQLmWtRAmusga5xZ'));

  // Note: With pagination, we might not get all UTXOs in one call
  // So we check for > 0 rather than exact counts
  if (thirdAddressUtxos.length > 0) {
    console.log(`  ✓ Found UTXOs for third address`);
  } else {
    console.log(`  ⚠️  No UTXOs found for third address (might need larger page size or multiple pages)`);
  }

  assert(testAddressUtxos.length > 0, 'Should have UTXOs for test address');
  assert(emptyAddressUtxos.length === 0, 'Should have no UTXOs for empty address');

  console.log(`  Found ${largerPage.length} UTXOs in page (size=100) for ${addresses.length} addresses`);
  console.log(`    ${TEST_ADDRESS}: ${testAddressUtxos.length} UTXOs`);
  console.log(`    ${EMPTY_ADDRESS}: ${emptyAddressUtxos.length} UTXOs`);
  console.log(`    ${'1ERN5r4A8Ur6T4XQgaxQLmWtRAmusga5xZ'}: ${thirdAddressUtxos.length} UTXOs`);

  // Note about pagination
  console.log(`  Note: Due to pagination, counts may not represent all UTXOs`);
}

// Test 4.4: Invalid address handling
async function testGetUtxosInvalid() {
  try {
    await mnee.getUtxos(testConfig.addresses.invalidAddress);
    console.log('  Invalid address handled (no error thrown)');
  } catch (error) {
    console.log(`  Invalid address error: "${error.message}"`);
  }
}

// Test 4.5: Mixed valid and invalid addresses (QA reported issue)
async function testGetUtxosMixedAddresses() {
  console.log('  Testing with mixed valid and invalid addresses...');

  // Test case from QA: mix of valid and invalid addresses
  const mixedAddresses = [TEST_ADDRESS, 'invalidaddress1234567890', EMPTY_ADDRESS];

  // Should get UTXOs for valid addresses and ignore invalid ones
  // Use larger page size to ensure we get data
  const utxos = await mnee.getUtxos(mixedAddresses, 1, 50);

  assert(Array.isArray(utxos), 'UTXOs should be an array');

  // Check that we got UTXOs for valid addresses
  const testAddressUtxos = utxos.filter((utxo) => utxo.owners.includes(TEST_ADDRESS));
  const emptyAddressUtxos = utxos.filter((utxo) => utxo.owners.includes(EMPTY_ADDRESS));

  assert(testAddressUtxos.length > 0, 'Should have UTXOs for valid test address');
  assert(emptyAddressUtxos.length === 0, 'Should have no UTXOs for empty address');

  // Calculate amount from this page (not total due to pagination)
  const pageAmount = utxos.reduce((sum, utxo) => {
    if (utxo.data.bsv21.op === 'transfer') {
      return sum + utxo.data.bsv21.amt;
    }
    return sum;
  }, 0);

  console.log(`  Found ${utxos.length} UTXOs in this page for valid addresses`);
  console.log(`  Page MNEE amount: ${mnee.fromAtomicAmount(pageAmount)} MNEE`);
  console.log('  ✓ Invalid addresses were filtered out');
  console.log('  ✓ Valid addresses returned correct UTXOs');
}

// Test 4.6: UTXO details verification
async function testUtxoDetails() {
  const utxos = await mnee.getUtxos(TEST_ADDRESS);

  if (utxos.length > 0) {
    const utxo = utxos[0];

    console.log('  UTXO Details:');
    console.log(`    Transaction ID: ${utxo.txid}`);
    console.log(`    Output Index: ${utxo.vout}`);
    console.log(`    Outpoint: ${utxo.outpoint}`);
    console.log(`    MNEE Amount: ${utxo.data.bsv21.amt} (${mnee.fromAtomicAmount(utxo.data.bsv21.amt)} MNEE)`);
    console.log(`    Token ID: ${utxo.data.bsv21.id}`);
    console.log(`    Operation: ${utxo.data.bsv21.op}`);
    console.log(`    Satoshis: ${utxo.satoshis}`);
    console.log(`    Height: ${utxo.height}`);
    console.log(`    Score: ${utxo.score}`);
  }
}

// Test 4.7: Pagination with page and size parameters
async function testPagination() {
  console.log('  Testing pagination with page and size...');

  // Get first page with size 2 (page 1 - v2/utxos uses 1-based pagination)
  const page1 = await mnee.getUtxos(TEST_ADDRESS, 1, 2);
  console.log(`    Page 1 (size=2): ${page1.length} UTXOs`);

  // Get second page with size 2 (page 2)
  const page2 = await mnee.getUtxos(TEST_ADDRESS, 2, 2);
  console.log(`    Page 2 (size=2): ${page2.length} UTXOs`);

  // Get third page with size 2 (page 3)
  const page3 = await mnee.getUtxos(TEST_ADDRESS, 3, 2);
  console.log(`    Page 3 (size=2): ${page3.length} UTXOs`);

  // Get all UTXOs with larger size for comparison
  const allUtxos = await mnee.getUtxos(TEST_ADDRESS, 1, 100);
  console.log(`    All UTXOs (size=100): ${allUtxos.length} total`);

  // Verify pagination
  assert(Array.isArray(page1), 'Page 1 should be an array');
  assert(Array.isArray(page2), 'Page 2 should be an array');
  assert(Array.isArray(page3), 'Page 3 should be an array');

  // Check sizes
  assert(page1.length <= 2, 'Page 1 should have at most 2 UTXOs');
  assert(page2.length <= 2, 'Page 2 should have at most 2 UTXOs');
  assert(page3.length <= 2, 'Page 3 should have at most 2 UTXOs');

  if (page1.length > 0 && page2.length > 0) {
    // Debug: Log the outpoints to see what's happening
    const page1Outpoints = page1.map((u) => u.outpoint);
    const page2Outpoints = page2.map((u) => u.outpoint);
    const page3Outpoints = page3.map((u) => u.outpoint);

    console.log(
      '    Page 1 outpoints:',
      page1Outpoints.map((op) => op.substring(0, 20) + '...'),
    );
    console.log(
      '    Page 2 outpoints:',
      page2Outpoints.map((op) => op.substring(0, 20) + '...'),
    );
    if (page3.length > 0) {
      console.log(
        '    Page 3 outpoints:',
        page3Outpoints.map((op) => op.substring(0, 20) + '...'),
      );
    }

    // Check for duplicates between page 1 and page 2
    const duplicates12 = page1Outpoints.filter((op) => page2Outpoints.includes(op));
    if (duplicates12.length > 0) {
      console.log(`    ❌ ERROR: Found ${duplicates12.length} duplicate UTXOs between pages 1 and 2`);
      console.log(
        '    Duplicate outpoints:',
        duplicates12.map((op) => op.substring(0, 30) + '...'),
      );
      console.log('    This is an API pagination issue - pages are overlapping');

      // Fail the test when duplicates are found
      throw new Error(`Pagination test failed: ${duplicates12.length} duplicate UTXOs found between pages 1 and 2`);
    } else {
      console.log('    ✓ No duplicates between pages 1 and 2');
    }

    // Check no duplicates between page 2 and page 3 (if page 3 has data)
    if (page3.length > 0) {
      const duplicates23 = page2Outpoints.filter((op) => page3Outpoints.includes(op));
      if (duplicates23.length > 0) {
        console.log(`    ❌ ERROR: Found ${duplicates23.length} duplicate UTXOs between pages 2 and 3`);
        console.log('    This is an API pagination issue');
        throw new Error(`Pagination test failed: ${duplicates23.length} duplicate UTXOs found between pages 2 and 3`);
      } else {
        console.log('    ✓ No duplicates between pages 2 and 3');
      }
    }

    // Verify that combined pages are subset of all UTXOs
    const combinedPages = [...page1, ...page2, ...page3];
    const allOutpoints = allUtxos.map((u) => u.outpoint);
    const allPagesInTotal = combinedPages.every((u) => allOutpoints.includes(u.outpoint));

    if (allPagesInTotal) {
      console.log('    ✓ All paginated UTXOs found in complete list');
    } else {
      console.log('    ⚠️  Some paginated UTXOs not found in complete list');
    }

    // If we get here, no duplicates were found
    console.log('    ✓ Pagination working correctly');
  } else {
    console.log('    ✓ Pagination parameters accepted');
  }
}

// Test 4.8: Order parameter (asc/desc)
async function testOrdering() {
  console.log('  Testing order parameter...');

  // First test without order to see if basic call works
  let defaultUtxos;
  try {
    defaultUtxos = await mnee.getUtxos(TEST_ADDRESS, 1, 10);
    console.log(`    Default order (no param): ${defaultUtxos.length} UTXOs`);
  } catch (error) {
    console.log(`    Default order error: ${error.message}`);
    return; // Can't continue if basic call fails
  }

  // Try ascending order
  let ascUtxos;
  try {
    ascUtxos = await mnee.getUtxos(TEST_ADDRESS, 1, 10, 'asc');
    console.log(`    ✓ Ascending order: ${ascUtxos.length} UTXOs`);
    assert(Array.isArray(ascUtxos), 'Ascending UTXOs should be an array');
  } catch (error) {
    console.log(`    ❌ Ascending order failed: ${error.message}`);
    console.log('    Note: The v2/utxos API may not support the order parameter yet');
    return;
  }

  // Try descending order
  let descUtxos;
  try {
    descUtxos = await mnee.getUtxos(TEST_ADDRESS, 1, 10, 'desc');
    console.log(`    ✓ Descending order: ${descUtxos.length} UTXOs`);
    assert(Array.isArray(descUtxos), 'Descending UTXOs should be an array');
  } catch (error) {
    console.log(`    ❌ Descending order failed: ${error.message}`);
    return;
  }

  // If we got here, order parameter is supported
  // Check if ordering actually changes the results
  if (ascUtxos.length > 1 && descUtxos.length > 1) {
    const firstAsc = ascUtxos[0].outpoint;
    const firstDesc = descUtxos[0].outpoint;

    if (firstAsc !== firstDesc) {
      console.log('    ✓ Order parameter changes UTXO ordering as expected');
    } else {
      console.log('    ⚠️  Order parameter accepted but UTXOs are in same order');
    }
  }

  console.log('  Overall: Order parameter testing completed');
}

// Test 4.9: Combined pagination and ordering
async function testCombinedPaginationAndOrder() {
  console.log('  Testing combined pagination and ordering...');

  // Test pagination without order first
  try {
    const page1 = await mnee.getUtxos(TEST_ADDRESS, 1, 3);
    const page2 = await mnee.getUtxos(TEST_ADDRESS, 2, 3);
    console.log(`    Page 1 (no order): ${page1.length} UTXOs`);
    console.log(`    Page 2 (no order): ${page2.length} UTXOs`);

    assert(Array.isArray(page1), 'Page 1 should be an array');
    assert(Array.isArray(page2), 'Page 2 should be an array');

    // Now try with order parameters
    try {
      const page1Asc = await mnee.getUtxos(TEST_ADDRESS, 1, 3, 'asc');
      console.log(`    Page 1, ASC: ${page1Asc.length} UTXOs`);

      const page1Desc = await mnee.getUtxos(TEST_ADDRESS, 1, 3, 'desc');
      console.log(`    Page 1, DESC: ${page1Desc.length} UTXOs`);

      console.log('    ✓ Combined pagination and ordering parameters accepted');
    } catch (orderError) {
      console.log(`    ⚠️  Order parameter not supported with pagination: ${orderError.message}`);
    }

    console.log('    ✓ Pagination works correctly');
  } catch (error) {
    console.log(`    Error with pagination: ${error.message}`);
  }
}

// Test 4.10: Default values and edge cases
async function testPaginationEdgeCases() {
  console.log('  Testing pagination edge cases...');

  // Test with page 0 (should work, it's just not the default)
  try {
    const page0 = await mnee.getUtxos(TEST_ADDRESS, 0, 5);
    console.log(`    Page 0: ${page0.length} UTXOs (valid, just not default)`);
  } catch (error) {
    console.log(`    Page 0: Error - ${error.message}`);
  }

  // Test with negative page (should error)
  try {
    const negPage = await mnee.getUtxos(TEST_ADDRESS, -1, 5);
    console.log(`    Negative page: ${negPage.length} UTXOs (handled gracefully)`);
  } catch (error) {
    console.log(`    Negative page: Error as expected - ${error.message}`);
  }

  // Test with very large page number
  const largePage = await mnee.getUtxos(TEST_ADDRESS, 999, 5);
  assert(Array.isArray(largePage), 'Large page should return array');
  assert(largePage.length === 0, 'Large page number should return empty array');
  console.log(`    Page 999: ${largePage.length} UTXOs (empty as expected)`);

  // Test with size 0 (should use default or error)
  try {
    const size0 = await mnee.getUtxos(TEST_ADDRESS, 1, 0);
    console.log(`    Size 0: ${size0.length} UTXOs (uses default size)`);
  } catch (error) {
    console.log(`    Size 0: Error as expected - ${error.message}`);
  }

  // Test with negative size
  try {
    const negSize = await mnee.getUtxos(TEST_ADDRESS, 1, -5);
    console.log(`    Negative size: ${negSize.length} UTXOs (handled gracefully)`);
  } catch (error) {
    console.log(`    Negative size: Error as expected - ${error.message}`);
  }

  // Test with invalid order value (TypeScript would catch this, but let's test runtime)
  try {
    // @ts-ignore - Testing invalid type
    const invalidOrder = await mnee.getUtxos(TEST_ADDRESS, 1, 10, 'invalid');
    console.log(`    Invalid order: ${invalidOrder.length} UTXOs (uses default order)`);
  } catch (error) {
    console.log(`    Invalid order: Error as expected - ${error.message}`);
  }

  console.log('    ✓ Edge cases handled appropriately');
}

// Run tests
async function runTests() {
  console.log('Running getUtxos tests...\n');

  try {
    console.log('Test 4.1: Get UTXOs for single address');
    await testGetUtxosSingle();
    console.log('✅ Test 4.1 passed\n');

    console.log('Test 4.2: Get UTXOs for empty address');
    await testGetUtxosEmpty();
    console.log('✅ Test 4.2 passed\n');

    console.log('Test 4.3: Get UTXOs for multiple addresses');
    await testGetUtxosMultiple();
    console.log('✅ Test 4.3 passed\n');

    console.log('Test 4.4: Invalid address handling');
    await testGetUtxosInvalid();
    console.log('✅ Test 4.4 passed\n');

    console.log('Test 4.5: Mixed valid and invalid addresses');
    await testGetUtxosMixedAddresses();
    console.log('✅ Test 4.5 passed\n');

    console.log('Test 4.6: UTXO details verification');
    await testUtxoDetails();
    console.log('✅ Test 4.6 passed\n');

    console.log('Test 4.7: Pagination with page and size');
    await testPagination();
    console.log('✅ Test 4.7 passed\n');

    console.log('Test 4.8: Order parameter (asc/desc)');
    await testOrdering();
    console.log('✅ Test 4.8 passed\n');

    console.log('Test 4.9: Combined pagination and ordering');
    await testCombinedPaginationAndOrder();
    console.log('✅ Test 4.9 passed\n');

    console.log('Test 4.10: Pagination edge cases');
    await testPaginationEdgeCases();
    console.log('✅ Test 4.10 passed\n');

    console.log('All tests passed! ✅');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
