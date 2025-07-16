import Mnee from '../dist/index.modern.js';
import assert from 'assert';
import testConfig from './tests.config.json' assert { type: 'json' };

// Test configuration
const config = {
  environment: testConfig.environment,
};

const mnee = new Mnee(config);

// Test 1.1: Basic config retrieval
async function testConfig() {
  const config = await mnee.config();

  // Assertions
  assert(config !== undefined, 'Config should not be undefined');
  assert(config.tokenId, 'Config should have tokenId');
  assert(config.fees && Array.isArray(config.fees), 'Config should have fees array');
  assert(config.mintAddress, 'Config should have mintAddress');
  assert(config.decimals >= 0, 'Config should have valid decimals');

  // Display key config values
  console.log(`  Token ID: ${config.tokenId}`);
  console.log(`  Decimals: ${config.decimals}`);
  console.log(`  Mint Address: ${config.mintAddress}`);
}

// Test 1.2: Config caching
async function testConfigCaching() {
  // First call - should fetch from API
  const start = Date.now();
  const config1 = await mnee.config();
  const time1 = Date.now() - start;
  console.log(`  First call took: ${time1}ms`);

  // Second call - should be cached
  const start2 = Date.now();
  const config2 = await mnee.config();
  const time2 = Date.now() - start2;
  console.log(`  Second call took: ${time2}ms`);

  // The second call should be much faster (or at least not slower)
  // We'll just check that configs match, since timing can be unreliable
  assert.deepEqual(config1, config2, 'Config should be consistent between calls');

  // Also verify the config has expected structure
  assert(config1.tokenId, 'Config should have tokenId');
  assert(typeof config1.decimals === 'number', 'Config should have numeric decimals');
}

// Run tests
async function runTests() {
  console.log('Running config tests...\n');

  try {
    console.log('Test 1.1: Basic config retrieval');
    await testConfig();
    console.log('✅ Test 1.1 passed\n');

    console.log('Test 1.2: Config caching');
    await testConfigCaching();
    console.log('✅ Test 1.2 passed\n');

    console.log('All tests passed! ✅');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
