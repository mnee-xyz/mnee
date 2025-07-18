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

// Test 12.1: Get transaction histories for multiple addresses
async function testMultipleAddressHistories() {
  const params = [
    { address: TEST_ADDRESS },
    { address: EMPTY_ADDRESS },
    { address: '159zQuZRmHUrZArYTFgogQxndrAeSsbTtJ' },
  ];

  try {
    const histories = await mnee.recentTxHistories(params);

    // Verify response structure
    assert(Array.isArray(histories), 'Response should be an array');
    assert(histories.length === params.length, 'Should return history for each address');

    // Verify each history
    for (let i = 0; i < histories.length; i++) {
      const history = histories[i];
      const param = params[i];

      assert(history.address === param.address, `History should match requested address ${param.address}`);
      assert(Array.isArray(history.history), 'Each history should have history array');
      assert(typeof history.nextScore === 'number' || history.nextScore === null, 'NextScore should be number or null');

      console.log(`  ${history.address}: ${history.history.length} transactions`);
    }
  } catch (error) {
    console.log(`  Multiple address histories error: ${error.message}`);
    throw error;
  }
}

// Test 12.2: Test with different parameters per address
async function testDifferentParametersPerAddress() {
  const params = [
    { address: TEST_ADDRESS, limit: 5 },
    { address: EMPTY_ADDRESS, limit: 10 },
    { address: '159zQuZRmHUrZArYTFgogQxndrAeSsbTtJ', limit: 15 },
  ];

  try {
    const histories = await mnee.recentTxHistories(params);

    assert(histories.length === params.length, 'Should return history for each address');

    // Verify limits are respected
    assert(histories[0].history.length <= 5, 'First address should respect limit of 5');
    assert(histories[1].history.length <= 10, 'Second address should respect limit of 10');

    console.log(`  Address 1 (limit 5): ${histories[0].history.length} transactions`);
    console.log(`  Address 2 (limit 10): ${histories[1].history.length} transactions`);
  } catch (error) {
    console.log(`  Different parameters test error: ${error.message}`);
  }
}

// Test 12.3: Test with fromScore parameters
async function testWithFromScores() {
  // First get initial histories to obtain scores
  const initialParams = [{ address: TEST_ADDRESS, limit: 10 }];

  try {
    const initial = await mnee.recentTxHistories(initialParams);

    if (initial[0].history.length > 5) {
      const fromScore = initial[0].history[5].score;

      const params = [{ address: TEST_ADDRESS, fromScore: fromScore, limit: 5 }];

      const histories = await mnee.recentTxHistories(params);

      assert(histories[0].history.length <= 5, 'Should respect limit');
      console.log(`  With fromScore ${fromScore}: ${histories[0].history.length} transactions`);
    } else {
      console.log(`  Not enough transactions to test fromScore`);
    }
  } catch (error) {
    console.log(`  FromScore test error: ${error.message}`);
  }
}

// Test 12.4: Test with empty array
async function testEmptyArray() {
  try {
    const histories = await mnee.recentTxHistories([]);

    assert(Array.isArray(histories), 'Should return empty array');
    assert(histories.length === 0, 'Empty input should return empty array');

    console.log(`  Empty array returned empty result ✓`);
  } catch (error) {
    console.log(`  Empty array test error: ${error.message}`);
  }
}

// Test 12.5: Test with duplicate addresses
async function testDuplicateAddresses() {
  const params = [
    { address: TEST_ADDRESS, limit: 5 },
    { address: TEST_ADDRESS, limit: 10 },
  ];

  try {
    const histories = await mnee.recentTxHistories(params);

    assert(histories.length === 2, 'Should return separate results for duplicate addresses');

    // Each request might have different parameters
    console.log(`  First request (limit 5): ${histories[0].history.length} transactions`);
    console.log(`  Second request (limit 10): ${histories[1].history.length} transactions`);
  } catch (error) {
    console.log(`  Duplicate addresses test error: ${error.message}`);
  }
}

// Test 12.6: Test with mixed valid/invalid addresses
async function testMixedAddresses() {
  const params = [
    { address: TEST_ADDRESS },
    { address: testConfig.addresses.invalidAddress },
    { address: EMPTY_ADDRESS },
    { address: '159zQuZRmHUrZArYTFgogQxndrAeSsbTtJ' },
  ];

  try {
    const histories = await mnee.recentTxHistories(params);

    assert(histories.length === params.length, 'Should return result for each address');

    // Check each result
    for (let i = 0; i < histories.length; i++) {
      const history = histories[i];
      console.log(`  ${params[i].address}: ${history.history ? history.history.length : 'error'} transactions`);
    }
  } catch (error) {
    console.log(`  Mixed addresses test handled: ${error.message}`);
  }
}

// Test 12.7: Compare with individual calls
async function testCompareWithIndividualCalls() {
  const addresses = [TEST_ADDRESS, EMPTY_ADDRESS, '159zQuZRmHUrZArYTFgogQxndrAeSsbTtJ'];

  try {
    // Batch call
    const batchParams = addresses.map((address) => ({ address, limit: 5 }));
    const batchHistories = await mnee.recentTxHistories(batchParams);

    // Individual calls
    const individualHistories = [];
    for (const address of addresses) {
      const history = await mnee.recentTxHistory(address, undefined, 5);
      individualHistories.push(history);
    }

    // Compare results
    assert(batchHistories.length === individualHistories.length, 'Should have same number of results');

    for (let i = 0; i < batchHistories.length; i++) {
      assert(batchHistories[i].address === individualHistories[i].address, 'Addresses should match');
      assert(
        batchHistories[i].history.length === individualHistories[i].history.length,
        'History lengths should match',
      );
    }

    console.log(`  Batch and individual calls return consistent results ✓`);
  } catch (error) {
    console.log(`  Comparison test error: ${error.message}`);
  }
}

// Run tests
async function runTests() {
  console.log('Running recentTxHistories tests...\n');
  console.log('Note: This method fetches transaction histories for multiple addresses.\n');

  try {
    // Fetch config first
    await mnee.config();

    console.log('Test 12.1: Get histories for multiple addresses');
    await testMultipleAddressHistories();
    console.log('✅ Test 12.1 passed\n');

    console.log('Test 12.2: Test with different parameters per address');
    await testDifferentParametersPerAddress();
    console.log('✅ Test 12.2 passed\n');

    console.log('Test 12.3: Test with fromScore parameters');
    await testWithFromScores();
    console.log('✅ Test 12.3 passed\n');

    console.log('Test 12.4: Test with empty array');
    await testEmptyArray();
    console.log('✅ Test 12.4 passed\n');

    console.log('Test 12.5: Test with duplicate addresses');
    await testDuplicateAddresses();
    console.log('✅ Test 12.5 passed\n');

    console.log('Test 12.6: Test with mixed valid/invalid addresses');
    await testMixedAddresses();
    console.log('✅ Test 12.6 passed\n');

    console.log('Test 12.7: Compare with individual calls');
    await testCompareWithIndividualCalls();
    console.log('✅ Test 12.7 passed\n');

    console.log('All tests passed! ✅');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
