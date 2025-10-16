import Mnee from '@mnee/ts-sdk';
import assert from 'assert';
import testConfigJson from '../testConfig.js';

// Test configuration
const config = {
  environment: testConfigJson.environment,
  apiKey: testConfigJson.apiKey,
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
  console.log(config);
}

// Run tests
async function runTests() {
  console.log('Running config tests...\n');

  try {
    console.log('Test 1.1: Basic config retrieval');
    await testConfig();
    console.log('✅ Test 1.1 passed\n');

    console.log('All tests passed! ✅');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
