import Mnee from '@mnee/ts-sdk';
import assert from 'assert';
import testConfig from '../testConfig.js';

// Test configuration
const config = {
  environment: testConfig.environment,
  apiKey: testConfig.apiKey,
};

const mnee = new Mnee(config);

// Test 1.2: refreshConfig returns a valid config object
async function testRefreshConfigStructure() {
  try {
    const refreshed = await mnee.refreshConfig();

    assert(refreshed !== undefined, 'refreshConfig should not return undefined');
    assert(refreshed !== null, 'refreshConfig should not return null');
    assert(typeof refreshed === 'object', 'refreshConfig should return an object');
    assert(refreshed.tokenId, 'Refreshed config should have tokenId');
    assert(typeof refreshed.tokenId === 'string', 'tokenId should be a string');
    assert(refreshed.fees && Array.isArray(refreshed.fees), 'Refreshed config should have fees array');
    assert(refreshed.fees.length > 0, 'Fees array should not be empty');
    assert(refreshed.mintAddress, 'Refreshed config should have mintAddress');
    assert(typeof refreshed.decimals === 'number' && refreshed.decimals >= 0, 'Config should have valid decimals');
    assert(refreshed.approver, 'Refreshed config should have approver public key');
    assert(refreshed.feeAddress, 'Refreshed config should have feeAddress');

    console.log(`  Refreshed config has valid structure ✓`);
    console.log(`  tokenId: ${refreshed.tokenId.substring(0, 20)}...`);
    console.log(`  fees tiers: ${refreshed.fees.length}`);
    console.log(`  decimals: ${refreshed.decimals}`);
  } catch (error) {
    console.log(`  refreshConfig structure error: ${error.message}`);
    throw error;
  }
}

// Test 1.3: refreshConfig returns the same values as config()
async function testRefreshConfigConsistency() {
  try {
    // Fetch using the regular config() method
    const original = await mnee.config();

    // Refresh the config
    const refreshed = await mnee.refreshConfig();

    // Both should return structurally identical data for the same environment
    assert(original.tokenId === refreshed.tokenId, 'tokenId should be identical after refresh');
    assert(original.mintAddress === refreshed.mintAddress, 'mintAddress should be identical after refresh');
    assert(original.approver === refreshed.approver, 'approver should be identical after refresh');
    assert(original.feeAddress === refreshed.feeAddress, 'feeAddress should be identical after refresh');
    assert(original.decimals === refreshed.decimals, 'decimals should be identical after refresh');
    assert(original.fees.length === refreshed.fees.length, 'fees array length should be identical after refresh');

    console.log(`  refreshConfig returns consistent data with config() ✓`);
  } catch (error) {
    console.log(`  refreshConfig consistency error: ${error.message}`);
    throw error;
  }
}

// Test 1.4: refreshConfig updates the cached config used by subsequent calls
async function testRefreshConfigUpdatesCachedConfig() {
  try {
    // First call to warm up the cache
    const first = await mnee.config();
    assert(first.tokenId, 'First config call should succeed');

    // Refresh should succeed and the cache should be updated
    const refreshed = await mnee.refreshConfig();
    assert(refreshed.tokenId, 'refreshConfig should return valid config');

    // Subsequent config() calls should use the newly cached value
    const afterRefresh = await mnee.config();
    assert(afterRefresh.tokenId === refreshed.tokenId, 'config() after refresh should return refreshed value');
    assert(afterRefresh.approver === refreshed.approver, 'Approver should match after cache update');

    console.log(`  Cache correctly updated after refreshConfig() ✓`);
  } catch (error) {
    console.log(`  refreshConfig cache update error: ${error.message}`);
    throw error;
  }
}

// Test 1.5: Multiple sequential refreshConfig calls all succeed
async function testRefreshConfigMultipleCalls() {
  try {
    const results = [];

    for (let i = 0; i < 3; i++) {
      const refreshed = await mnee.refreshConfig();
      assert(refreshed.tokenId, `Call ${i + 1} should return valid config`);
      results.push(refreshed.tokenId);
    }

    // All calls should return the same tokenId
    const allMatch = results.every((id) => id === results[0]);
    assert(allMatch, 'All refreshConfig calls should return the same tokenId');

    console.log(`  3 sequential refreshConfig calls all succeeded ✓`);
  } catch (error) {
    console.log(`  refreshConfig multiple calls error: ${error.message}`);
    throw error;
  }
}

// Test 1.6: refreshConfig fee tiers are valid
async function testRefreshConfigFeeTiers() {
  try {
    const refreshed = await mnee.refreshConfig();

    assert(Array.isArray(refreshed.fees), 'Fees should be an array');
    assert(refreshed.fees.length > 0, 'There should be at least one fee tier');

    for (const tier of refreshed.fees) {
      assert(typeof tier.min === 'number', 'Fee tier min should be a number');
      assert(typeof tier.max === 'number', 'Fee tier max should be a number');
      assert(typeof tier.fee === 'number', 'Fee tier fee should be a number');
      assert(tier.min <= tier.max, 'Fee tier min should be <= max');
      assert(tier.fee >= 0, 'Fee tier fee should be non-negative');
    }

    console.log(`  All ${refreshed.fees.length} fee tiers are valid ✓`);
    refreshed.fees.forEach((tier, i) => {
      console.log(`  Tier ${i + 1}: min=${tier.min}, max=${tier.max}, fee=${tier.fee}`);
    });
  } catch (error) {
    console.log(`  refreshConfig fee tiers error: ${error.message}`);
    throw error;
  }
}

// Test 1.7: refreshConfig with invalid API key fails gracefully
async function testRefreshConfigInvalidApiKey() {
  const badMnee = new Mnee({ environment: testConfig.environment, apiKey: 'invalid-key-000000000000000000' });

  let errorOccurred = false;
  try {
    // The constructor fires the initial fetch — wait for it (will fail)
    await badMnee.refreshConfig();
  } catch (error) {
    errorOccurred = true;
    console.log(`  Invalid API key error: "${error.message}"`);
    assert(
      error.message.includes('Invalid API key') || error.message.includes('HTTP error'),
      'Error should indicate invalid API key or HTTP error',
    );
  }

  assert(errorOccurred, 'refreshConfig with invalid API key should throw');
  console.log(`  refreshConfig rejects invalid API key correctly ✓`);
}

// Run tests
async function runTests() {
  console.log('Running refreshConfig tests...\n');
  console.log('Note: refreshConfig() forces a re-fetch of the MNEE config from the API,');
  console.log('resetting the cached config. Normally config is fetched once at SDK init.\n');

  try {
    // Warm up the SDK (config is fetched at construction, but let's be explicit)
    await mnee.config();

    console.log('Test 1.2: refreshConfig returns valid config structure');
    await testRefreshConfigStructure();
    console.log('✅ Test 1.2 passed\n');

    console.log('Test 1.3: refreshConfig returns consistent data with config()');
    await testRefreshConfigConsistency();
    console.log('✅ Test 1.3 passed\n');

    console.log('Test 1.4: refreshConfig updates the cached config');
    await testRefreshConfigUpdatesCachedConfig();
    console.log('✅ Test 1.4 passed\n');

    console.log('Test 1.5: Multiple sequential refreshConfig calls all succeed');
    await testRefreshConfigMultipleCalls();
    console.log('✅ Test 1.5 passed\n');

    console.log('Test 1.6: refreshConfig fee tiers are valid');
    await testRefreshConfigFeeTiers();
    console.log('✅ Test 1.6 passed\n');

    console.log('Test 1.7: refreshConfig with invalid API key fails gracefully');
    await testRefreshConfigInvalidApiKey();
    console.log('✅ Test 1.7 passed\n');

    console.log('All tests passed! ✅');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
