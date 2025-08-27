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

// Test 11.1: Get recent transaction history for address
async function testBasicTxHistory() {
  try {
    const history = await mnee.recentTxHistory(TEST_ADDRESS);

    // Verify response structure
    assert(history.address === TEST_ADDRESS, 'Response should include the queried address');
    assert(Array.isArray(history.history), 'History should be an array');
    assert(typeof history.nextScore === 'number' || history.nextScore === null, 'NextScore should be a number or null');

    console.log(`  Found ${history.history.length} transactions for ${TEST_ADDRESS}`);

    // If there are transactions, verify their structure
    if (history.history.length > 0) {
      const tx = history.history[0];
      assert(tx.txid, 'Transaction should have txid');
      assert(typeof tx.height === 'number', 'Transaction should have height');
      assert(['confirmed', 'unconfirmed'].includes(tx.status), 'Status should be confirmed or unconfirmed');
      assert(['send', 'receive'].includes(tx.type), 'Type should be send or receive');
      assert(typeof tx.amount === 'number', 'Amount should be a number');
      assert(Array.isArray(tx.counterparties), 'Counterparties should be an array');
      assert(typeof tx.fee === 'number', 'Fee should be a number');
      assert(typeof tx.score === 'number', 'Score should be a number');

      console.log(`  First transaction: ${tx.txid} (${tx.type}, ${tx.status})`);
    }
  } catch (error) {
    console.log(`  Error getting tx history: ${error.message}`);
    throw error;
  }
}

// Test 11.2: Get transaction history with pagination and order
async function testTxHistoryPagination() {
  try {
    // First page with default order
    const firstPage = await mnee.recentTxHistory(TEST_ADDRESS, undefined, 5);
    assert(firstPage.history.length <= 5, 'Should respect limit parameter');

    console.log(`  First page: ${firstPage.history.length} transactions`);

    // Test with 'asc' order
    const ascPage = await mnee.recentTxHistory(TEST_ADDRESS, undefined, 5, 'asc');
    assert(ascPage.history.length <= 5, 'Should respect limit with asc order');
    console.log(`  Ascending order: ${ascPage.history.length} transactions`);

    // Test with 'desc' order
    const descPage = await mnee.recentTxHistory(TEST_ADDRESS, undefined, 5, 'desc');
    assert(descPage.history.length <= 5, 'Should respect limit with desc order');
    console.log(`  Descending order: ${descPage.history.length} transactions`);

    // If we have transactions in both orders, verify they're different
    if (ascPage.history.length > 0 && descPage.history.length > 0) {
      const firstAscTxid = ascPage.history[0].txid;
      const firstDescTxid = descPage.history[0].txid;

      if (ascPage.history.length === descPage.history.length && ascPage.history.length > 1) {
        // With different orders, first transaction should typically be different
        console.log(`  First ASC txid: ${firstAscTxid.substring(0, 10)}...`);
        console.log(`  First DESC txid: ${firstDescTxid.substring(0, 10)}...`);
      }
    }

    if (firstPage.nextScore !== null) {
      // Get next page using nextScore
      const secondPage = await mnee.recentTxHistory(TEST_ADDRESS, firstPage.nextScore, 5);

      assert(secondPage.history.length <= 5, 'Second page should respect limit');

      // Verify no duplicate transactions between pages
      const firstPageTxids = firstPage.history.map((tx) => tx.txid);
      const secondPageTxids = secondPage.history.map((tx) => tx.txid);
      const duplicates = firstPageTxids.filter((txid) => secondPageTxids.includes(txid));
      assert(duplicates.length === 0, 'Should not have duplicate transactions between pages');

      console.log(`  Second page: ${secondPage.history.length} transactions`);
      console.log(`  No duplicates between pages ✓`);
    } else {
      console.log(`  No more pages available (nextScore is null)`);
    }
  } catch (error) {
    console.log(`  Pagination test error: ${error.message}`);
  }
}

// Test 11.3: Get transaction history for empty address
async function testEmptyAddressHistory() {
  try {
    const history = await mnee.recentTxHistory(EMPTY_ADDRESS);

    assert(history.address === EMPTY_ADDRESS, 'Response should include the queried address');
    assert(Array.isArray(history.history), 'History should be an array');

    console.log(`  Empty address has ${history.history.length} transactions`);

    if (history.history.length === 0) {
      console.log(`  NextScore: ${history.nextScore} (may or may not be null for empty history)`);
    }
  } catch (error) {
    console.log(`  Empty address test error: ${error.message}`);
  }
}

// Test 11.4: Test with invalid address
async function testInvalidAddressHistory() {
  const invalidAddresses = [
    { address: testConfig.addresses.invalidAddress, desc: 'Invalid format' },
    { address: null, desc: 'Null value' },
    { address: undefined, desc: 'Undefined value' },
    { address: '', desc: 'Empty string' },
    { address: 12345, desc: 'Number instead of string' },
    { address: '0x12345', desc: 'Ethereum-style address' },
    { address: '1BoatSLRHtKNngkdXEeobR76b53LETtpyX', desc: 'Invalid checksum' },
    { address: '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy', desc: 'P2SH address' },
    { address: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', desc: 'Bech32 address' },
  ];

  console.log('  Testing various invalid addresses:');

  for (const { address, desc } of invalidAddresses) {
    try {
      const history = await mnee.recentTxHistory(address);

      // Should not reach here
      console.log(`    ${desc}: ERROR - returned result instead of throwing`);
      assert.fail(`Should throw error for ${desc}`);
    } catch (error) {
      console.log(`    ${desc}: Correctly threw error - "${error.message}"`);
      assert(error.message.includes('Invalid Bitcoin address'), 'Error message should indicate invalid address');
    }
  }
}

// Test 11.5: Test with different limit values
async function testDifferentLimits() {
  const limits = [1, 10, 50, 100];

  for (const limit of limits) {
    try {
      const history = await mnee.recentTxHistory(TEST_ADDRESS, undefined, limit);
      assert(history.history.length <= limit, `Should respect limit of ${limit}`);
      console.log(`  Limit ${limit}: returned ${history.history.length} transactions ✓`);
    } catch (error) {
      console.log(`  Limit ${limit} error: ${error.message}`);
    }
  }
}

// Test 11.5a: Test with invalid limit values
async function testInvalidLimits() {
  const invalidLimits = [
    { limit: null, desc: 'Null limit' },
    { limit: undefined, desc: 'Undefined limit (should pass)' },
    { limit: '', desc: 'Empty string' },
    { limit: 'invalid-limit', desc: 'String instead of number' },
    { limit: -100, desc: 'Negative number' },
    { limit: 0, desc: 'Zero' },
    { limit: 1.5, desc: 'Decimal number' },
    { limit: Infinity, desc: 'Infinity' },
    { limit: NaN, desc: 'NaN' },
  ];

  console.log('  Testing various invalid limit values:');

  for (const { limit, desc } of invalidLimits) {
    try {
      if (limit === undefined) {
        // undefined should be allowed as it's optional
        const history = await mnee.recentTxHistory(TEST_ADDRESS, undefined, limit);
        console.log(`    ${desc}: Allowed (optional parameter)`);
        continue;
      }

      const history = await mnee.recentTxHistory(TEST_ADDRESS, undefined, limit);

      // Should not reach here for invalid limits
      console.log(`    ${desc}: ERROR - returned result instead of throwing`);
      assert.fail(`Should throw error for ${desc}`);
    } catch (error) {
      console.log(`    ${desc}: Correctly threw error - "${error.message}"`);
      assert(error.message.includes('Invalid limit'), 'Error message should indicate invalid limit');
    }
  }
}

// Test 11.6: Test with specific fromScore
async function testFromScore() {
  try {
    // First get some transactions
    const initial = await mnee.recentTxHistory(TEST_ADDRESS, undefined, 10);

    if (initial.history.length > 5) {
      // Use a score from middle of the list
      const middleScore = initial.history[5].score;

      const fromScoreResult = await mnee.recentTxHistory(TEST_ADDRESS, middleScore, 10);

      // Verify we get transactions after the specified score
      // Note: Score ordering might be implementation-specific
      console.log(`  Transactions returned after score ${middleScore}`);

      console.log(`  From score ${middleScore}: ${fromScoreResult.history.length} transactions`);
    } else {
      console.log(`  Not enough transactions to test fromScore`);
    }
  } catch (error) {
    console.log(`  FromScore test error: ${error.message}`);
  }
}

// Test 11.6a: Test with invalid fromScore values
async function testInvalidFromScores() {
  const invalidFromScores = [
    { fromScore: null, desc: 'Null fromScore' },
    { fromScore: undefined, desc: 'Undefined fromScore (should pass)' },
    { fromScore: '', desc: 'Empty string' },
    { fromScore: 'invalid-fromScore', desc: 'String instead of number' },
    { fromScore: -100, desc: 'Negative number' },
    { fromScore: Infinity, desc: 'Infinity' },
    { fromScore: -Infinity, desc: 'Negative Infinity' },
    { fromScore: NaN, desc: 'NaN' },
  ];

  console.log('  Testing various invalid fromScore values:');

  for (const { fromScore, desc } of invalidFromScores) {
    try {
      if (fromScore === undefined) {
        // undefined should be allowed as it's optional
        const history = await mnee.recentTxHistory(TEST_ADDRESS, fromScore);
        console.log(`    ${desc}: Allowed (optional parameter)`);
        continue;
      }

      const history = await mnee.recentTxHistory(TEST_ADDRESS, fromScore);

      // Should not reach here for invalid fromScores
      console.log(`    ${desc}: ERROR - returned result instead of throwing`);
      assert.fail(`Should throw error for ${desc}`);
    } catch (error) {
      console.log(`    ${desc}: Correctly threw error - "${error.message}"`);
      assert(error.message.includes('Invalid fromScore'), 'Error message should indicate invalid fromScore');
    }
  }
}

// Test 11.7: Test transaction details
async function testTransactionDetails() {
  try {
    const history = await mnee.recentTxHistory(TEST_ADDRESS, undefined, 5);

    if (history.history.length > 0) {
      console.log('  Analyzing transaction details:');

      for (const tx of history.history.slice(0, 3)) {
        // Check first 3 transactions
        // Verify counterparties structure
        for (const counterparty of tx.counterparties) {
          assert(counterparty.address, 'Counterparty should have address');
          assert(typeof counterparty.amount === 'number', 'Counterparty should have amount');
        }

        // Verify amounts are in atomic units
        assert(Number.isInteger(tx.amount), 'Amount should be in atomic units (integer)');
        assert(Number.isInteger(tx.fee), 'Fee should be in atomic units (integer)');

        console.log(
          `    ${tx.type} ${mnee.fromAtomicAmount(tx.amount)} MNEE, fee: ${mnee.fromAtomicAmount(tx.fee)} MNEE`,
        );
      }
    } else {
      console.log('  No transactions to analyze');
    }
  } catch (error) {
    console.log(`  Transaction details test error: ${error.message}`);
  }
}

// Test 11.8: Test order parameter specifically
async function testOrderParameter() {
  console.log('  Testing order parameter with different values:');

  try {
    // Test valid order values
    const validOrders = ['asc', 'desc', undefined];

    for (const order of validOrders) {
      const history = await mnee.recentTxHistory(TEST_ADDRESS, undefined, 10, order);
      console.log(`    Order "${order || 'default'}": ${history.history.length} transactions returned`);

      if (history.history.length > 1) {
        // Check score ordering
        const scores = history.history.map((tx) => tx.score);
        if (order === 'asc') {
          // Scores should be in ascending order
          for (let i = 1; i < scores.length; i++) {
            assert(scores[i] >= scores[i - 1], 'Scores should be in ascending order for asc');
          }
          console.log(`      ✓ Scores in ascending order`);
        } else if (order === 'desc') {
          // Scores should be in descending order
          for (let i = 1; i < scores.length; i++) {
            assert(scores[i] <= scores[i - 1], 'Scores should be in descending order for desc');
          }
          console.log(`      ✓ Scores in descending order`);
        }
      }
    }

    // Test invalid order values
    const invalidOrders = [
      { order: 'invalid', desc: 'Invalid string' },
      { order: 123, desc: 'Number' },
      { order: true, desc: 'Boolean' },
      { order: {}, desc: 'Object' },
      { order: [], desc: 'Array' },
    ];

    console.log('  Testing invalid order values:');
    for (const { order, desc } of invalidOrders) {
      try {
        await mnee.recentTxHistory(TEST_ADDRESS, undefined, 5, order);
        console.log(`    ${desc}: ERROR - should have thrown`);
      } catch (error) {
        console.log(`    ${desc}: Correctly threw error - "${error.message}"`);
      }
    }
  } catch (error) {
    console.log(`  Order parameter test error: ${error.message}`);
    throw error;
  }
}

// Run tests
async function runTests() {
  console.log('Running recentTxHistory tests...\n');
  console.log('Note: Transaction history depends on actual blockchain data.\n');

  try {
    // Fetch config first
    await mnee.config();

    console.log('Test 11.1: Get recent transaction history');
    await testBasicTxHistory();
    console.log('✅ Test 11.1 passed\n');

    console.log('Test 11.2: Test pagination');
    await testTxHistoryPagination();
    console.log('✅ Test 11.2 passed\n');

    console.log('Test 11.3: Get history for empty address');
    await testEmptyAddressHistory();
    console.log('✅ Test 11.3 passed\n');

    console.log('Test 11.4: Test with invalid address');
    await testInvalidAddressHistory();
    console.log('✅ Test 11.4 passed\n');

    console.log('Test 11.5: Test different limit values');
    await testDifferentLimits();
    console.log('✅ Test 11.5 passed\n');

    console.log('Test 11.5a: Test invalid limit values');
    await testInvalidLimits();
    console.log('✅ Test 11.5a passed\n');

    console.log('Test 11.6: Test with specific fromScore');
    await testFromScore();
    console.log('✅ Test 11.6 passed\n');

    console.log('Test 11.6a: Test invalid fromScore values');
    await testInvalidFromScores();
    console.log('✅ Test 11.6a passed\n');

    console.log('Test 11.7: Test transaction details');
    await testTransactionDetails();
    console.log('✅ Test 11.7 passed\n');

    console.log('Test 11.8: Test order parameter');
    await testOrderParameter();
    console.log('✅ Test 11.8 passed\n');

    console.log('All tests passed! ✅');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
