// Shared setup for batch tests
import Mnee from 'mnee';
import assert from 'assert';
import testConfig from '../testConfig.js';

// Test configuration
export const config = {
  environment: testConfig.environment,
  apiKey: testConfig.apiKey,
};

export const mnee = new Mnee(config);

// Test addresses for batch operations
export const TEST_ADDRESSES = [
  testConfig.addresses.testAddress,
  testConfig.addresses.emptyAddress,
  '1ERN5r4A8Ur6T4XQgaxQLmWtRAmusga5xZ',
  '159zQuZRmHUrZArYTFgogQxndrAeSsbTtJ',
  '1Q9gVBxBdu7hmRv7KJg8mRFcSCTNNH8JdZ',
];

// Export commonly used modules
export { assert, testConfig, Mnee };