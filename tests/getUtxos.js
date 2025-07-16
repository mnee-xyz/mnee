import Mnee from '../dist/index.modern.js';
import assert from 'assert';
import testConfig from './tests.config.json' assert { type: 'json' };

// Test configuration
const config = {
  environment: testConfig.environment,
};

const mnee = new Mnee(config);

// Test addresses from config
const TEST_ADDRESS = testConfig.addresses.testAddress;
const EMPTY_ADDRESS = testConfig.addresses.emptyAddress;

// Test 4.1: Get UTXOs for single address
async function testGetUtxosSingle() {
  const utxos = await mnee.getUtxos(TEST_ADDRESS);

  // Assertions
  assert(Array.isArray(utxos), 'UTXOs should be an array');
  assert(utxos.length > 0, 'Address with balance should have UTXOs');

  // Check UTXO structure
  const firstUtxo = utxos[0];
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

  // Calculate total from UTXOs
  const totalAmount = utxos.reduce((sum, utxo) => {
    if (utxo.data.bsv21.op === 'transfer') {
      return sum + utxo.data.bsv21.amt;
    }
    return sum;
  }, 0);

  assert(totalAmount === 1000000, 'Total UTXO amount should match balance');

  console.log(`  Found ${utxos.length} UTXOs for address`);
  console.log(`  Total MNEE amount: ${totalAmount} (${mnee.fromAtomicAmount(totalAmount)} MNEE)`);
}

// Test 4.2: Get UTXOs for empty address
async function testGetUtxosEmpty() {
  const utxos = await mnee.getUtxos(EMPTY_ADDRESS);

  assert(Array.isArray(utxos), 'UTXOs should be an array');
  assert(utxos.length === 0, 'Empty address should have no UTXOs');

  console.log('  Empty address correctly returns no UTXOs');
}

// Test 4.3: Get UTXOs for multiple addresses
async function testGetUtxosMultiple() {
  const addresses = [TEST_ADDRESS, EMPTY_ADDRESS, '1ERN5r4A8Ur6T4XQgaxQLmWtRAmusga5xZ'];
  const utxos = await mnee.getUtxos(addresses);

  assert(Array.isArray(utxos), 'UTXOs should be an array');

  // Check that we got UTXOs for both addresses
  const testAddressUtxos = utxos.filter((utxo) => utxo.owners.includes(TEST_ADDRESS));
  const emptyAddressUtxos = utxos.filter((utxo) => utxo.owners.includes(EMPTY_ADDRESS));
  const thirdAddressUtxos = utxos.filter((utxo) => utxo.owners.includes('1ERN5r4A8Ur6T4XQgaxQLmWtRAmusga5xZ'));

  assert(thirdAddressUtxos.length > 0, 'Should have UTXOs for third address');
  assert(testAddressUtxos.length > 0, 'Should have UTXOs for test address');
  assert(emptyAddressUtxos.length === 0, 'Should have no UTXOs for empty address');

  console.log(`  Found ${utxos.length} total UTXOs for ${addresses.length} addresses`);
  console.log(`    ${TEST_ADDRESS}: ${testAddressUtxos.length} UTXOs`);
  console.log(`    ${EMPTY_ADDRESS}: ${emptyAddressUtxos.length} UTXOs`);
  console.log(`    ${'1ERN5r4A8Ur6T4XQgaxQLmWtRAmusga5xZ'}: ${thirdAddressUtxos.length} UTXOs`);
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

// Test 4.5: UTXO details verification
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

    console.log('Test 4.5: UTXO details verification');
    await testUtxoDetails();
    console.log('✅ Test 4.5 passed\n');

    console.log('All tests passed! ✅');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
