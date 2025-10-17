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

// Test 12.2: Test with different parameters per address (including order)
async function testDifferentParametersPerAddress() {
  const params = [
    { address: TEST_ADDRESS, limit: 5, order: 'asc' },
    { address: EMPTY_ADDRESS, limit: 10, order: 'desc' },
    { address: '159zQuZRmHUrZArYTFgogQxndrAeSsbTtJ', limit: 15 },
  ];

  try {
    const histories = await mnee.recentTxHistories(params);

    assert(histories.length === params.length, 'Should return history for each address');

    // Verify limits are respected
    assert(histories[0].history.length <= 5, 'First address should respect limit of 5');
    assert(histories[1].history.length <= 10, 'Second address should respect limit of 10');

    console.log(`  Address 1 (limit 5, order asc): ${histories[0].history.length} transactions`);
    console.log(`  Address 2 (limit 10, order desc): ${histories[1].history.length} transactions`);
    console.log(`  Address 3 (limit 15, default order): ${histories[2].history.length} transactions`);
    
    // Verify order for addresses with transactions
    if (histories[0].history.length > 1) {
      const scores = histories[0].history.map(tx => tx.score);
      for (let i = 1; i < scores.length; i++) {
        assert(scores[i] >= scores[i-1], 'Address 1 scores should be in ascending order');
      }
      console.log('    ✓ Address 1 transactions in ascending order');
    }
    
    if (histories[1].history.length > 1) {
      const scores = histories[1].history.map(tx => tx.score);
      for (let i = 1; i < scores.length; i++) {
        assert(scores[i] <= scores[i-1], 'Address 2 scores should be in descending order');
      }
      console.log('    ✓ Address 2 transactions in descending order');
    }
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

    // Should not reach here
    assert.fail('Should throw error for empty array');
  } catch (error) {
    console.log(`  Empty array correctly threw error: "${error.message}"`);
    assert(error.message.includes('You must pass at least 1 address parameter'), 'Error message should indicate empty array');
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
    { address: null },
    { address: '0x12345' },
    { address: '' },
    { address: undefined },
    { address: 12345 },
    { address: '159zQuZRmHUrZArYTFgogQxndrAeSsbTtJ' },
  ];

  try {
    // Capture console.warn to verify warning is shown
    const originalWarn = console.warn;
    let warnCalled = false;
    console.warn = (...args) => {
      warnCalled = true;
      originalWarn.apply(console, args);
    };

    const histories = await mnee.recentTxHistories(params);
    
    // Restore console.warn
    console.warn = originalWarn;

    // Should only return valid addresses
    const validAddresses = [TEST_ADDRESS, EMPTY_ADDRESS, '159zQuZRmHUrZArYTFgogQxndrAeSsbTtJ'];
    assert(histories.length === validAddresses.length, `Should return ${validAddresses.length} valid addresses`);
    
    // Verify all returned addresses are valid
    for (const history of histories) {
      assert(validAddresses.includes(history.address), `${history.address} should be in valid addresses list`);
      assert(Array.isArray(history.history), 'History should be an array');
    }
    
    // Verify warning was shown
    assert(warnCalled, 'Should show warning for invalid addresses');
    
    console.log(`  Mixed addresses handled correctly: ${histories.length} valid addresses processed`);
    console.log(`  Invalid addresses were filtered out with warning ✓`);
  } catch (error) {
    console.log(`  Mixed addresses test error: ${error.message}`);
    throw error;
  }
}

// Test 12.6a: Test with all invalid addresses
async function testAllInvalidAddresses() {
  const params = [
    { address: 'invalid-address' },
    { address: null },
    { address: '0x12345' },
    { address: '' },
    { address: undefined },
    { address: 12345 },
  ];

  try {
    await mnee.recentTxHistories(params);
    
    // Should not reach here
    assert.fail('Should throw error when all addresses are invalid');
  } catch (error) {
    console.log(`  All invalid addresses correctly threw error: "${error.message}"`);
    assert(error.message.includes('You must pass at least 1 valid address'), 'Error message should indicate no valid addresses');
  }
}

// Test 12.7: Test with invalid parameter types
async function testInvalidParameterTypes() {
  const invalidParams = [
    { params: null, desc: 'Null' },
    { params: undefined, desc: 'Undefined' },
    { params: 'string', desc: 'String' },
    { params: 123, desc: 'Number' },
    { params: { address: TEST_ADDRESS }, desc: 'Object' },
    { params: true, desc: 'Boolean' },
  ];

  console.log('  Testing various invalid parameter types:');
  
  for (const { params, desc } of invalidParams) {
    try {
      const histories = await mnee.recentTxHistories(params);
      
      // Should not reach here
      console.log(`    ${desc}: ERROR - returned result instead of throwing`);
      assert.fail(`Should throw error for ${desc}`);
    } catch (error) {
      console.log(`    ${desc}: Correctly threw error - "${error.message}"`);
      assert(error.message.includes('must be an array'), 'Error message should indicate array requirement');
    }
  }
}

// Test 12.8: Test with invalid address formats in params
async function testInvalidAddressFormats() {
  const invalidParams = [
    [{ address: null }],
    [{ address: undefined }],
    [{ address: '' }],
    [{ address: 12345 }],
    [{ address: '0x12345' }],
    [{ address: '1BoatSLRHtKNngkdXEeobR76b53LETtpyX' }], // Invalid checksum
    [{ address: '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy' }], // P2SH
    [{ address: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4' }], // Bech32
  ];

  console.log('  Testing various invalid address formats:');
  
  for (const params of invalidParams) {
    try {
      const histories = await mnee.recentTxHistories(params);
      
      // Should not reach here
      console.log(`    ${params[0].address}: ERROR - returned result instead of throwing`);
      assert.fail(`Should throw error for ${params[0].address}`);
    } catch (error) {
      console.log(`    ${params[0].address}: Correctly threw error`);
      assert(error.message.includes('You must pass at least 1 valid address'), 'Error message should indicate no valid addresses');
    }
  }
}

// Test 12.9: Test with invalid parameter values
async function testInvalidParameterValues() {
  console.log('  Testing various invalid parameter values:');
  
  // Test invalid limit values
  const invalidLimitParams = [
    [{ address: TEST_ADDRESS, limit: null }],
    [{ address: TEST_ADDRESS, limit: '' }],
    [{ address: TEST_ADDRESS, limit: 'invalid-limit' }],
    [{ address: TEST_ADDRESS, limit: -100 }],
    [{ address: TEST_ADDRESS, limit: 0 }],
    [{ address: TEST_ADDRESS, limit: 1.5 }],
    [{ address: TEST_ADDRESS, limit: Infinity }],
    [{ address: TEST_ADDRESS, limit: NaN }],
  ];

  for (const params of invalidLimitParams) {
    try {
      const histories = await mnee.recentTxHistories(params);
      
      // Should not reach here
      console.log(`    Limit ${params[0].limit}: ERROR - returned result instead of throwing`);
      assert.fail(`Should throw error for limit ${params[0].limit}`);
    } catch (error) {
      console.log(`    Limit ${params[0].limit}: Correctly threw error - "${error.message}"`);
      assert(error.message.includes('Invalid limit'), 'Error message should indicate invalid limit');
    }
  }

  // Test invalid fromScore values
  const invalidFromScoreParams = [
    [{ address: TEST_ADDRESS, fromScore: null }],
    [{ address: TEST_ADDRESS, fromScore: '' }],
    [{ address: TEST_ADDRESS, fromScore: 'invalid-fromScore' }],
    [{ address: TEST_ADDRESS, fromScore: -100 }],
    [{ address: TEST_ADDRESS, fromScore: Infinity }],
    [{ address: TEST_ADDRESS, fromScore: -Infinity }],
    [{ address: TEST_ADDRESS, fromScore: NaN }],
  ];

  for (const params of invalidFromScoreParams) {
    try {
      const histories = await mnee.recentTxHistories(params);
      
      // Should not reach here
      console.log(`    FromScore ${params[0].fromScore}: ERROR - returned result instead of throwing`);
      assert.fail(`Should throw error for fromScore ${params[0].fromScore}`);
    } catch (error) {
      console.log(`    FromScore ${params[0].fromScore}: Correctly threw error - "${error.message}"`);
      assert(error.message.includes('Invalid fromScore'), 'Error message should indicate invalid fromScore');
    }
  }
  
  // Test invalid order values
  const invalidOrderParams = [
    [{ address: TEST_ADDRESS, order: 'invalid' }],
    [{ address: TEST_ADDRESS, order: 123 }],
    [{ address: TEST_ADDRESS, order: true }],
    [{ address: TEST_ADDRESS, order: {} }],
    [{ address: TEST_ADDRESS, order: [] }],
    [{ address: TEST_ADDRESS, order: null }],
  ];

  for (const params of invalidOrderParams) {
    try {
      const histories = await mnee.recentTxHistories(params);
      
      // Should not reach here
      console.log(`    Order ${JSON.stringify(params[0].order)}: ERROR - returned result instead of throwing`);
      assert.fail(`Should throw error for order ${JSON.stringify(params[0].order)}`);
    } catch (error) {
      // Check if this is our assert.fail error
      if (error.message.startsWith('Should throw error for order')) {
        throw error; // Re-throw the assert.fail error
      }
      console.log(`    Order ${JSON.stringify(params[0].order)}: Correctly threw error - "${error.message}"`);
      assert(error.message.includes('Invalid order') || error.message.includes('400') || 
             error.message.includes("Must be 'asc' or 'desc'"), 
             'Error message should indicate invalid order');
    }
  }
}

// Test 12.10: Test duplicate transaction handling
async function testDuplicateTransactionHandling() {
  try {
    // Use addresses that might have interacted with each other
    const params = [
      { address: TEST_ADDRESS, limit: 50 },
      { address: '1ERN5r4A8Ur6T4XQgaxQLmWtRAmusga5xZ', limit: 50 },
      { address: '159zQuZRmHUrZArYTFgogQxndrAeSsbTtJ', limit: 50 },
    ];

    const histories = await mnee.recentTxHistories(params);

    // Check that each address has unique transactions (no duplicates by txid)
    for (let i = 0; i < histories.length; i++) {
      const history = histories[i];
      const txids = history.history.map(tx => tx.txid);
      const uniqueTxids = new Set(txids);
      
      assert(
        txids.length === uniqueTxids.size,
        `Address ${history.address} should not have duplicate transactions`
      );
      
      console.log(`  ${history.address}: ${history.history.length} unique transactions ✓`);
    }

    // Check if any transactions appear in multiple addresses (this is allowed)
    const allTxids = new Map();
    for (let i = 0; i < histories.length; i++) {
      const history = histories[i];
      for (const tx of history.history) {
        if (!allTxids.has(tx.txid)) {
          allTxids.set(tx.txid, []);
        }
        allTxids.get(tx.txid).push({
          address: history.address,
          type: tx.type
        });
      }
    }

    const sharedTxids = [...allTxids.entries()].filter(([_, addresses]) => addresses.length > 1);
    if (sharedTxids.length > 0) {
      console.log(`  Found ${sharedTxids.length} transactions between multiple addresses (this is expected)`);
      // Show a few examples
      sharedTxids.slice(0, 3).forEach(([txid, addresses]) => {
        console.log(`    Transaction ${txid.substring(0, 8)}... appears in:`);
        addresses.forEach(({ address, type }) => {
          console.log(`      - ${address} (${type})`);
        });
      });
    }
  } catch (error) {
    console.log(`  Duplicate handling test error: ${error.message}`);
    throw error;
  }
}

// Test 12.11: Compare with individual calls
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

    console.log('Test 12.6a: Test with all invalid addresses');
    await testAllInvalidAddresses();
    console.log('✅ Test 12.6a passed\n');

    console.log('Test 12.7: Test with invalid parameter types');
    await testInvalidParameterTypes();
    console.log('✅ Test 12.7 passed\n');

    console.log('Test 12.8: Test with invalid address formats');
    await testInvalidAddressFormats();
    console.log('✅ Test 12.8 passed\n');

    console.log('Test 12.9: Test with invalid parameter values');
    await testInvalidParameterValues();
    console.log('✅ Test 12.9 passed\n');

    console.log('Test 12.10: Test duplicate transaction handling');
    await testDuplicateTransactionHandling();
    console.log('✅ Test 12.10 passed\n');

    console.log('Test 12.11: Compare with individual calls');
    await testCompareWithIndividualCalls();
    console.log('✅ Test 12.11 passed\n');

    console.log('All tests passed! ✅');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
