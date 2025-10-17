// Test 18.8: Batch with HD wallet integration
import { mnee, assert, Mnee } from './setup.js';

async function testBatchWithHDWallet() {
  try {
    const batch = mnee.batch();

    // Generate HD wallet addresses
    const mnemonic = Mnee.HDWallet.generateMnemonic();
    const hdWallet = mnee.HDWallet(mnemonic, {
      derivationPath: "m/44'/236'/0'",
    });

    // Generate 10 addresses
    const hdAddresses = [];
    for (let i = 0; i < 10; i++) {
      hdAddresses.push(hdWallet.deriveAddress(i, false).address);
    }

    // Batch check balances
    const result = await batch.getBalances(hdAddresses, {
      chunkSize: 5,
      requestsPerSecond: 10,
    });

    assert(result.results.length === hdAddresses.length, 'Should check all HD addresses');
    assert(result.totalProcessed === 2, 'Should process 2 chunks of 5');

    // All new addresses should have 0 balance
    const allZeroBalance = result.results.every((b) => b.decimalAmount === 0);
    assert(allZeroBalance, 'New HD addresses should have 0 balance');

    console.log('  HD wallet batch integration works ✓');

    // Test UTXO scanning for HD addresses
    const utxoResult = await batch.getUtxos(hdAddresses, {
      chunkSize: 3,
      requestsPerSecond: 10,
      onProgress: (completed, total) => {
        assert(completed <= total, 'Progress should not exceed total');
        assert(completed > 0 && total > 0, 'Progress values should be positive');
      },
    });

    assert(utxoResult.results.length === hdAddresses.length, 'Should scan all addresses');
    const allEmpty = utxoResult.results.every((r) => r.utxos.length === 0);
    assert(allEmpty, 'New addresses should have no UTXOs');

    console.log('  HD wallet UTXO scanning works ✓');
  } catch (error) {
    console.log(`  Batch HD wallet error: ${error.message}`);
    throw error;
  }
}

// Run test
async function runTest() {
  console.log('Test 18.8: Batch with HD wallet integration');
  await testBatchWithHDWallet();
  console.log('✅ Test 18.8 passed\n');
}

runTest().catch(error => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});