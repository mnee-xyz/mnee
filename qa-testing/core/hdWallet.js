import Mnee from '@mnee/ts-sdk';
import assert from 'assert';
import testConfig from '../testConfig.js';

// Test configuration
const config = {
  environment: testConfig.environment,
  apiKey: testConfig.apiKey,
};

const mnee = new Mnee(config);

// Test mnemonics
const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const INVALID_MNEMONIC = 'invalid phrase that is not a valid mnemonic';

// Test 17.1: Static methods
async function testStaticMethods() {
  try {
    // Test mnemonic generation
    const generatedMnemonic = Mnee.HDWallet.generateMnemonic();
    assert(typeof generatedMnemonic === 'string', 'Generated mnemonic should be string');
    assert(generatedMnemonic.split(' ').length === 12, 'Generated mnemonic should have 12 words');
    console.log('  Generated mnemonic with 12 words ✓');
    
    // Test mnemonic validation
    assert(Mnee.HDWallet.isValidMnemonic(TEST_MNEMONIC) === true, 'Test mnemonic should be valid');
    assert(Mnee.HDWallet.isValidMnemonic(generatedMnemonic) === true, 'Generated mnemonic should be valid');
    assert(Mnee.HDWallet.isValidMnemonic(INVALID_MNEMONIC) === false, 'Invalid mnemonic should be false');
    assert(Mnee.HDWallet.isValidMnemonic('') === false, 'Empty string should be invalid');
    console.log('  Mnemonic validation works correctly ✓');
  } catch (error) {
    console.log(`  Static methods error: ${error.message}`);
    throw error;
  }
}

// Test 17.2: HDWallet creation and basic derivation
async function testWalletCreation() {
  try {
    // Test valid wallet creation
    const hdWallet = mnee.HDWallet(TEST_MNEMONIC, {
      derivationPath: "m/44'/236'/0'",
      cacheSize: 100
    });
    assert(hdWallet, 'HDWallet should be created');
    console.log('  HDWallet created successfully ✓');
    
    // Test invalid mnemonic
    let errorThrown = false;
    try {
      mnee.HDWallet(INVALID_MNEMONIC, {
        derivationPath: "m/44'/236'/0'"
      });
    } catch (error) {
      errorThrown = true;
      assert(error.message.includes('Invalid mnemonic'), 'Should throw invalid mnemonic error');
    }
    assert(errorThrown, 'Should throw error for invalid mnemonic');
    console.log('  Invalid mnemonic rejected correctly ✓');
    
    // Test default cache size
    const hdWalletDefault = mnee.HDWallet(TEST_MNEMONIC, {
      derivationPath: "m/44'/236'/0'"
    });
    assert(hdWalletDefault, 'HDWallet with default cache should be created');
    console.log('  Default cache size works ✓');
  } catch (error) {
    console.log(`  Wallet creation error: ${error.message}`);
    throw error;
  }
}

// Test 17.3: Address derivation
async function testAddressDerivation() {
  try {
    const hdWallet = mnee.HDWallet(TEST_MNEMONIC, {
      derivationPath: "m/44'/236'/0'",
      cacheSize: 10
    });
    
    // Test single address derivation
    const addr0 = hdWallet.deriveAddress(0, false);
    assert(addr0.address, 'Should have address');
    assert(addr0.privateKey, 'Should have private key');
    assert(addr0.path === "m/44'/236'/0'/0/0", 'Path should be correct');
    assert(addr0.address.startsWith('1'), 'Address should be valid Bitcoin address');
    console.log(`  Derived receive address 0: ${addr0.address} ✓`);
    
    // Test change address
    const changeAddr0 = hdWallet.deriveAddress(0, true);
    assert(changeAddr0.path === "m/44'/236'/0'/1/0", 'Change path should be correct');
    assert(changeAddr0.address !== addr0.address, 'Change address should be different');
    console.log(`  Derived change address 0: ${changeAddr0.address} ✓`);
    
    // Test consistent derivation
    const addr0Again = hdWallet.deriveAddress(0, false);
    assert(addr0Again.address === addr0.address, 'Same index should give same address');
    assert(addr0Again.privateKey === addr0.privateKey, 'Same index should give same private key');
    console.log('  Consistent derivation verified ✓');
    
    // Test cache hit
    const cacheSize1 = hdWallet.getCacheSize();
    hdWallet.deriveAddress(0, false); // Should hit cache
    const cacheSize2 = hdWallet.getCacheSize();
    assert(cacheSize1 === cacheSize2, 'Cache hit should not increase cache size');
    console.log('  Cache hit verified ✓');
  } catch (error) {
    console.log(`  Address derivation error: ${error.message}`);
    throw error;
  }
}

// Test 17.4: Batch address derivation
async function testBatchDerivation() {
  try {
    const hdWallet = mnee.HDWallet(TEST_MNEMONIC, {
      derivationPath: "m/44'/236'/0'"
    });
    
    // Test batch receive addresses
    const addresses = await hdWallet.deriveAddresses(0, 5, false);
    assert(Array.isArray(addresses), 'Should return array');
    assert(addresses.length === 5, 'Should return 5 addresses');
    
    // Verify addresses are sequential
    for (let i = 0; i < addresses.length; i++) {
      assert(addresses[i].path === `m/44'/236'/0'/0/${i}`, `Path ${i} should be correct`);
      assert(addresses[i].address, `Address ${i} should exist`);
      assert(addresses[i].privateKey, `Private key ${i} should exist`);
    }
    console.log('  Batch derived 5 receive addresses ✓');
    
    // Test batch change addresses
    const changeAddresses = await hdWallet.deriveAddresses(10, 3, true);
    assert(changeAddresses.length === 3, 'Should return 3 change addresses');
    assert(changeAddresses[0].path === "m/44'/236'/0'/1/10", 'First change path should be correct');
    assert(changeAddresses[2].path === "m/44'/236'/0'/1/12", 'Last change path should be correct');
    console.log('  Batch derived 3 change addresses ✓');
    
    // Test empty batch
    const emptyBatch = await hdWallet.deriveAddresses(0, 0, false);
    assert(Array.isArray(emptyBatch), 'Empty batch should return array');
    assert(emptyBatch.length === 0, 'Empty batch should have 0 addresses');
    console.log('  Empty batch handled correctly ✓');
  } catch (error) {
    console.log(`  Batch derivation error: ${error.message}`);
    throw error;
  }
}

// Test 17.5: Private key retrieval
async function testPrivateKeyRetrieval() {
  try {
    const hdWallet = mnee.HDWallet(TEST_MNEMONIC, {
      derivationPath: "m/44'/236'/0'"
    });
    
    // Derive some test addresses
    console.log('  Deriving test addresses...');
    const testAddresses = await hdWallet.deriveAddresses(0, 3, false);
    const changeAddresses = await hdWallet.deriveAddresses(0, 2, true);
    const addressList = testAddresses.map(a => a.address);
    const changeAddressList = changeAddresses.map(a => a.address);
    
    // Test getPrivateKeysForAddresses
    console.log('  Scanning for private keys (parallel strategy)...');
    const startScan = Date.now();
    const result = hdWallet.getPrivateKeysForAddresses(addressList, {
      maxScanReceive: 10,
      maxScanChange: 5,
      scanStrategy: 'parallel'
    });
    const scanTime = Date.now() - startScan;
    console.log(`  Scan completed in ${scanTime}ms`);
    
    assert(result.privateKeys, 'Should have privateKeys object');
    assert(result.paths, 'Should have paths object');
    assert(Object.keys(result.privateKeys).length === 3, 'Should find all 3 private keys');
    assert(Object.keys(result.paths).length === 3, 'Should find all 3 paths');
    
    // Verify keys match
    for (let i = 0; i < testAddresses.length; i++) {
      const addr = testAddresses[i].address;
      assert(result.privateKeys[addr] === testAddresses[i].privateKey, `Private key should match for ${addr}`);
      assert(result.paths[addr] === testAddresses[i].path, `Path should match for ${addr}`);
    }
    console.log('  Retrieved private keys with paths ✓');
    
    // Test simplified getPrivateKeys
    const justKeys = hdWallet.getPrivateKeys(changeAddressList);
    assert(Object.keys(justKeys).length === 2, 'Should find all 2 change private keys');
    for (let i = 0; i < changeAddresses.length; i++) {
      const addr = changeAddresses[i].address;
      assert(justKeys[addr] === changeAddresses[i].privateKey, `Change private key should match for ${addr}`);
    }
    console.log('  Retrieved private keys (simplified) ✓');
    
    // Test sequential scanning
    console.log('  Testing sequential scanning strategy...');
    const startSeq = Date.now();
    const seqResult = hdWallet.getPrivateKeysForAddresses([addressList[2]], {
      maxScanReceive: 5,
      scanStrategy: 'sequential'
    });
    const seqTime = Date.now() - startSeq;
    assert(seqResult.privateKeys[addressList[2]], 'Should find address with sequential scan');
    console.log(`  Sequential scanning works ✓ (${seqTime}ms)`);
    
    // Test cache hit for retrieval
    hdWallet.clearCache();
    const beforeCacheSize = hdWallet.getCacheSize();
    hdWallet.getPrivateKeys(addressList); // Will populate cache
    const afterCacheSize = hdWallet.getCacheSize();
    assert(afterCacheSize > beforeCacheSize, 'Should populate cache during scan');
    console.log('  Cache populated during scan ✓');
    
    // Test address not found
    let errorThrown = false;
    try {
      hdWallet.getPrivateKeys(['1BoatSLRHtKNngkdXEeobR76b53LETtpyT'], {
        maxScanReceive: 5,
        maxScanChange: 5
      });
    } catch (error) {
      errorThrown = true;
      assert(error.message.includes('Could not find private keys'), 'Should throw not found error');
    }
    assert(errorThrown, 'Should throw error for address not found');
    console.log('  Address not found error handled ✓');
  } catch (error) {
    console.log(`  Private key retrieval error: ${error.message}`);
    throw error;
  }
}

// Test 17.6: Address scanning with gap limit
async function testAddressScanning() {
  try {
    const hdWallet = mnee.HDWallet(TEST_MNEMONIC, {
      derivationPath: "m/44'/236'/0'"
    });
    
    // Mock function to simulate used addresses
    const usedAddresses = new Set();
    // Mark addresses 0, 1, 3 as used (gap at 2, then continuous gap from 4)
    const addr0 = hdWallet.deriveAddress(0, false);
    const addr1 = hdWallet.deriveAddress(1, false);
    const addr3 = hdWallet.deriveAddress(3, false);
    const changeAddr1 = hdWallet.deriveAddress(1, true);
    
    usedAddresses.add(addr0.address);
    usedAddresses.add(addr1.address);
    usedAddresses.add(addr3.address);
    usedAddresses.add(changeAddr1.address);
    
    const checkAddressUsed = async (address) => {
      return usedAddresses.has(address);
    };
    
    // Test with small gap limit
    const scanResult = await hdWallet.scanAddressesWithGapLimit(checkAddressUsed, {
      gapLimit: 5,
      scanChange: true,
      maxScan: 20
    });
    
    assert(scanResult.receive, 'Should have receive results');
    assert(scanResult.change, 'Should have change results');
    assert(Array.isArray(scanResult.receive), 'Receive should be array');
    assert(Array.isArray(scanResult.change), 'Change should be array');
    
    // Should find the 3 used receive addresses
    assert(scanResult.receive.length === 3, 'Should find 3 used receive addresses');
    assert(scanResult.receive[0].address === addr0.address, 'Should find address 0');
    assert(scanResult.receive[1].address === addr1.address, 'Should find address 1');
    assert(scanResult.receive[2].address === addr3.address, 'Should find address 3');
    
    // Should find 1 used change address
    assert(scanResult.change.length === 1, 'Should find 1 used change address');
    assert(scanResult.change[0].address === changeAddr1.address, 'Should find change address 1');
    
    console.log('  Address scanning with gap limit works ✓');
    
    // Test without scanning change
    const receiveOnlyResult = await hdWallet.scanAddressesWithGapLimit(checkAddressUsed, {
      gapLimit: 5,
      scanChange: false
    });
    
    assert(receiveOnlyResult.receive.length === 3, 'Should still find receive addresses');
    assert(receiveOnlyResult.change.length === 0, 'Should not scan change addresses');
    console.log('  Receive-only scanning works ✓');
    
    // Test with no used addresses
    const emptyCheckFunction = async () => false;
    const emptyResult = await hdWallet.scanAddressesWithGapLimit(emptyCheckFunction, {
      gapLimit: 5,
      maxScan: 10
    });
    
    assert(emptyResult.receive.length === 0, 'Should find no receive addresses');
    assert(emptyResult.change.length === 0, 'Should find no change addresses');
    console.log('  Empty wallet scanning works ✓');
  } catch (error) {
    console.log(`  Address scanning error: ${error.message}`);
    throw error;
  }
}

// Test 17.7: Cache management
async function testCacheManagement() {
  try {
    const hdWallet = mnee.HDWallet(TEST_MNEMONIC, {
      derivationPath: "m/44'/236'/0'",
      cacheSize: 5 // Small cache for testing
    });
    
    // Test cache starts empty
    assert(hdWallet.getCacheSize() === 0, 'Cache should start empty');
    console.log('  Cache starts empty ✓');
    
    // Derive addresses to populate cache
    for (let i = 0; i < 3; i++) {
      hdWallet.deriveAddress(i, false);
    }
    assert(hdWallet.getCacheSize() === 3, 'Cache should have 3 entries');
    console.log('  Cache populated correctly ✓');
    
    // Test cache limit
    for (let i = 3; i < 10; i++) {
      hdWallet.deriveAddress(i, false);
    }
    assert(hdWallet.getCacheSize() === 5, 'Cache should respect size limit');
    console.log('  Cache size limit enforced ✓');
    
    // Test cache clear
    hdWallet.clearCache();
    assert(hdWallet.getCacheSize() === 0, 'Cache should be empty after clear');
    console.log('  Cache cleared successfully ✓');
    
    // Test cache hit after clear
    hdWallet.deriveAddress(0, false);
    assert(hdWallet.getCacheSize() === 1, 'Cache should have 1 entry after clear and derive');
    console.log('  Cache works after clear ✓');
  } catch (error) {
    console.log(`  Cache management error: ${error.message}`);
    throw error;
  }
}

// Test 17.8: Integration with MNEE SDK
async function testMneeIntegration() {
  try {
    // Generate a new HD wallet
    const mnemonic = Mnee.HDWallet.generateMnemonic();
    const hdWallet = mnee.HDWallet(mnemonic, {
      derivationPath: "m/44'/236'/0'"
    });
    
    // Derive some addresses
    const addresses = await hdWallet.deriveAddresses(0, 3, false);
    const addressList = addresses.map(a => a.address);
    
    // Test balance check (should be 0 for new addresses)
    const balances = await mnee.balances(addressList);
    assert(Array.isArray(balances), 'Should return balance array');
    assert(balances.length === addressList.length, 'Should return balance for each address');
    
    for (const balance of balances) {
      assert(balance.address, 'Balance should have address');
      assert(typeof balance.amount === 'number', 'Balance should have amount');
      assert(typeof balance.decimalAmount === 'number', 'Balance should have decimalAmount');
      assert(addressList.includes(balance.address), 'Address should be in our list');
    }
    console.log('  Balance check integration works ✓');
    
    // Test UTXO retrieval
    const utxos = await mnee.getUtxos(addressList);
    assert(Array.isArray(utxos), 'Should return UTXO array');
    console.log('  UTXO retrieval integration works ✓');
    
    // Test with single address
    const singleBalance = await mnee.balance(addresses[0].address);
    assert(singleBalance.address === addresses[0].address, 'Single balance should match address');
    console.log('  Single address integration works ✓');
  } catch (error) {
    console.log(`  MNEE integration error: ${error.message}`);
    throw error;
  }
}

// Test 17.9: Edge cases and error handling
async function testEdgeCases() {
  try {
    const hdWallet = mnee.HDWallet(TEST_MNEMONIC, {
      derivationPath: "m/44'/236'/0'"
    });
    
    // Test very high index
    console.log('  Deriving address at very high index (999999)...');
    const startHighIndex = Date.now();
    const highIndex = hdWallet.deriveAddress(999999, false);
    const highIndexTime = Date.now() - startHighIndex;
    assert(highIndex.address, 'Should derive address at high index');
    assert(highIndex.path === "m/44'/236'/0'/0/999999", 'High index path should be correct');
    console.log(`  High index derivation works ✓ (${highIndexTime}ms)`);
    
    // Test batch with high starting index
    console.log('  Deriving batch starting at high index (100000)...');
    const startHighBatch = Date.now();
    const highBatch = await hdWallet.deriveAddresses(100000, 2, true);
    const highBatchTime = Date.now() - startHighBatch;
    assert(highBatch.length === 2, 'High index batch should work');
    assert(highBatch[0].path === "m/44'/236'/0'/1/100000", 'High batch path should be correct');
    console.log(`  High index batch works ✓ (${highBatchTime}ms)`);
    
    // Test empty address list for private key retrieval
    console.log('  Testing empty address list...');
    const emptyResult = hdWallet.getPrivateKeys([]);
    assert(Object.keys(emptyResult).length === 0, 'Empty address list should return empty object');
    console.log('  Empty address list handled ✓');
    
    // Test duplicate addresses in list
    console.log('  Testing duplicate address handling...');
    const addr = hdWallet.deriveAddress(5, false);
    const duplicateResult = hdWallet.getPrivateKeys([addr.address, addr.address]);
    assert(Object.keys(duplicateResult).length === 1, 'Duplicate addresses should be handled');
    assert(duplicateResult[addr.address] === addr.privateKey, 'Should return correct key for duplicate');
    console.log('  Duplicate addresses handled ✓');
  } catch (error) {
    console.log(`  Edge cases error: ${error.message}`);
    throw error;
  }
}

// Run tests
async function runTests() {
  console.log('Running HDWallet tests...\n');
  console.log('Note: HDWallet provides hierarchical deterministic wallet functionality.\n');

  try {
    console.log('Test 17.1: Static methods');
    await testStaticMethods();
    console.log('✅ Test 17.1 passed\n');

    console.log('Test 17.2: HDWallet creation');
    await testWalletCreation();
    console.log('✅ Test 17.2 passed\n');

    console.log('Test 17.3: Address derivation');
    await testAddressDerivation();
    console.log('✅ Test 17.3 passed\n');

    console.log('Test 17.4: Batch address derivation');
    await testBatchDerivation();
    console.log('✅ Test 17.4 passed\n');

    console.log('Test 17.5: Private key retrieval');
    await testPrivateKeyRetrieval();
    console.log('✅ Test 17.5 passed\n');

    console.log('Test 17.6: Address scanning with gap limit');
    await testAddressScanning();
    console.log('✅ Test 17.6 passed\n');

    console.log('Test 17.7: Cache management');
    await testCacheManagement();
    console.log('✅ Test 17.7 passed\n');

    console.log('Test 17.8: Integration with MNEE SDK');
    await testMneeIntegration();
    console.log('✅ Test 17.8 passed\n');

    console.log('Test 17.9: Edge cases and error handling');
    await testEdgeCases();
    console.log('✅ Test 17.9 passed\n');

    console.log('All tests passed! ✅');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();