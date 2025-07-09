import Mnee from '../dist/index.modern.js';

// Configuration
const config = {
  environment: 'sandbox',
};

const mnee = new Mnee(config);

// Test addresses - you can replace these with your own
const TEST_ADDRESSES = [
  '1ERN5r4A8Ur6T4XQgaxQLmWtRAmusga5xZ',
  '159zQuZRmHUrZArYTFgogQxndrAeSsbTtJ',
  '1525VDfA8swjDMLHjLRCCmPFsTJToarrA2',
  '1Q9gVBxBdu7hmRv7KJg8mRFcSCTNNH8JdZ',
  // Add more addresses as needed
];

const TEST_TXIDS = [
  '15576ce6dcc9cc623d84ca54a85e1bc97145e9bc186aa0f0dbb68f7aeb6bc82d',
  '8c5584f2c434c16959518a2f530ff6f98794f7d7d0ff00b1b25d5eadf260c7ff',
  '8d5632e8e91ddd322f47318b40fc63dd99dac896a05cf4de9aa81d6c8dc90096',
  '14c4989dcaefea230bc0b476e791750b98f402c4c3033f7f749867eb84388ffa',
  '5d619d825233b2fd84279e7d0f9c34d0cff6ea6b946aa15db6180fe468d8f9e7',
];

// Progress tracking helper
function createProgressTracker(operation) {
  const startTime = Date.now();
  return (completed, total, errors = 0) => {
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = completed / elapsed;
    const percentage = ((completed / total) * 100).toFixed(1);
    console.log(
      `[${operation}] ${percentage}% (${completed}/${total}) - ${rate.toFixed(1)} chunks/s - Errors: ${errors}`,
    );
  };
}

// Test 1: Basic Batch UTXO Fetching
async function testGetUtxosBatch() {
  console.log('\n=== Test 1: Batch UTXO Fetching ===\n');

  try {
    const batch = mnee.batch();
    const result = await batch.getUtxos(TEST_ADDRESSES, {
      chunkSize: 2,
      concurrency: 3,
      onProgress: createProgressTracker('UTXOs'),
    });

    console.log('\nResults:');
    console.log(`- Total processed: ${result.totalProcessed}`);
    console.log(`- Total errors: ${result.totalErrors}`);
    console.log(`- Successful addresses: ${result.results.length}`);

    // Show UTXOs per address with details
    result.results.forEach(({ address, utxos }) => {
      if (utxos.length > 0) {
        console.log(`\n  ${address}: ${utxos.length} UTXOs`);
        utxos.slice(0, 2).forEach((utxo, idx) => {
          console.log(`    UTXO ${idx + 1}:`);
          console.log(`      - Amount: ${utxo.data?.bsv21?.amt || 0} (${utxo.data?.bsv21?.op || 'unknown'})`);
          console.log(`      - Outpoint: ${utxo.txid}:${utxo.vout}`);
          console.log(`      - Height: ${utxo.height}`);
        });
        if (utxos.length > 2) {
          console.log(`    ... and ${utxos.length - 2} more UTXOs`);
        }
      }
    });

    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach(({ items, error }) => {
        console.log(`  Failed addresses: ${items.join(', ')}`);
        console.log(`  Error: ${error.message}`);
      });
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Test 2: Batch Balance Checking
async function testGetBalancesBatch() {
  console.log('\n=== Test 2: Batch Balance Checking ===\n');

  try {
    const batch = mnee.batch();
    const result = await batch.getBalances(TEST_ADDRESSES, {
      chunkSize: 3,
      continueOnError: true,
      onProgress: createProgressTracker('Balances'),
    });

    console.log('\nResults:');
    const totalBalance = result.results.reduce((sum, b) => sum + b.decimalAmount, 0);
    console.log(`- Total balance: ${totalBalance} MNEE`);
    console.log(`- Addresses checked: ${result.results.length}`);

    // Show all balances with more detail
    console.log('\nAddress balances:');
    result.results.forEach((b) => {
      const status = b.decimalAmount > 0 ? '✓' : '○';
      console.log(`  ${status} ${b.address}: ${b.decimalAmount} MNEE (${b.amount} atomic)`);
    });

    const fundedAddresses = result.results.filter((b) => b.decimalAmount > 0);
    if (fundedAddresses.length === 0) {
      console.log('\n  No funded addresses found in this batch.');
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Test 3: Batch Transaction History
async function testGetTxHistoriesBatch() {
  console.log('\n=== Test 3: Batch Transaction History ===\n');

  const params = TEST_ADDRESSES.map((address) => ({
    address,
    limit: 5,
  }));

  try {
    const batch = mnee.batch();
    const result = await batch.getTxHistories(params, {
      chunkSize: 2,
      onProgress: createProgressTracker('Histories'),
    });

    console.log('\nResults:');
    console.log(`- Addresses processed: ${result.results.length}`);

    // Show transaction details
    console.log('\nTransaction histories:');
    result.results.forEach((history) => {
      if (history.history.length > 0) {
        console.log(`\n  ${history.address}: ${history.history.length} transactions`);
        history.history.slice(0, 2).forEach((tx, idx) => {
          console.log(`    TX ${idx + 1}: ${tx.txid}`);
          console.log(`      - Amount: ${tx.amount}`);
          console.log(`      - Height: ${tx.height}`);
          console.log(`      - Type: ${tx.type}`);
        });
        if (history.history.length > 2) {
          console.log(`    ... and ${history.history.length - 2} more transactions`);
        }
      } else {
        console.log(`  ${history.address}: No transactions`);
      }
    });
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Test 4: Get All Data in Parallel
async function testGetAllDataBatch() {
  console.log('\n=== Test 4: Get All Data (Parallel) ===\n');

  try {
    const startTime = Date.now();

    const batch = mnee.batch();
    const data = await batch.getAll(TEST_ADDRESSES, {
      historyLimit: 10,
      chunkSize: 2,
      concurrency: 3,
      onProgress: createProgressTracker('All Data'),
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\nCompleted in ${duration} seconds`);
    console.log('\nSummary:');
    console.log(`- UTXOs: ${data.utxos.results.length} addresses processed, ${data.utxos.totalErrors} errors`);
    console.log(`- Balances: ${data.balances.results.length} addresses processed, ${data.balances.totalErrors} errors`);
    console.log(
      `- Histories: ${data.histories.results.length} addresses processed, ${data.histories.totalErrors} errors`,
    );

    // Calculate totals and show detailed breakdown
    const totalUtxos = data.utxos.results.reduce((sum, r) => sum + r.utxos.length, 0);
    const totalBalance = data.balances.results.reduce((sum, b) => sum + b.decimalAmount, 0);
    const totalTxs = data.histories.results.reduce((sum, h) => sum + h.history.length, 0);

    console.log('\nDetailed Totals:');
    console.log(`- Total UTXOs: ${totalUtxos}`);
    console.log(`- Total balance: ${totalBalance} MNEE`);
    console.log(`- Total transactions: ${totalTxs}`);

    // Show addresses with activity
    const activeAddresses = data.balances.results.filter(
      (b) =>
        b.decimalAmount > 0 ||
        data.utxos.results.find((u) => u.address === b.address)?.utxos.length > 0 ||
        data.histories.results.find((h) => h.address === b.address)?.history.length > 0,
    );

    console.log(`\nActive addresses: ${activeAddresses.length}/${TEST_ADDRESSES.length}`);
    if (activeAddresses.length > 0) {
      console.log('Active address summary:');
      activeAddresses.forEach((addr) => {
        const utxoCount = data.utxos.results.find((u) => u.address === addr.address)?.utxos.length || 0;
        const txCount = data.histories.results.find((h) => h.address === addr.address)?.history.length || 0;
        console.log(`  ${addr.address}:`);
        console.log(`    Balance: ${addr.decimalAmount} MNEE, UTXOs: ${utxoCount}, TXs: ${txCount}`);
      });
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Test 5: Error Handling and Recovery
async function testErrorHandling() {
  console.log('\n=== Test 5: Error Handling ===\n');

  // Mix valid and invalid addresses
  const mixedAddresses = [...TEST_ADDRESSES, 'invalid-address-1', 'invalid-address-2'];

  try {
    const batch = mnee.batch();
    const result = await batch.getBalances(mixedAddresses, {
      chunkSize: 2,
      continueOnError: true,
      maxRetries: 2,
      retryDelay: 500,
      onProgress: (completed, total, errors) => {
        console.log(`Progress: ${completed}/${total}, Errors: ${errors}`);
      },
    });

    console.log('\nResults:');
    console.log(`- Successful: ${result.results.length}`);
    console.log(`- Failed: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log('\nError details:');
      result.errors.forEach(({ items, error, retryCount }) => {
        console.log(`  Addresses: ${items.join(', ')}`);
        console.log(`  Error: ${error.message}`);
        console.log(`  Retries: ${retryCount}`);
      });
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Test 6: Batch Parse Transactions
async function testParseTxBatch() {
  console.log('\n=== Test 6: Batch Parse Transactions ===\n');

  try {
    const batch = mnee.batch();
    const result = await batch.parseTx(TEST_TXIDS, {
      parseOptions: { includeRaw: true },
      chunkSize: 5,
      continueOnError: true,
      onProgress: createProgressTracker('Parse TX'),
    });

    console.log('\nResults:');
    console.log(`- Transactions parsed: ${result.results.length}`);
    console.log(`- Failed: ${result.errors.length}`);

    // Show parsed transaction details
    if (result.results.length > 0) {
      console.log('\nParsed transaction details:');
      result.results.slice(0, 3).forEach(({ txid, parsed }, idx) => {
        console.log(`\n  TX ${idx + 1}: ${txid.substring(0, 16)}...`);
        console.log(`    Type: ${parsed.type}`);
        console.log(`    Valid: ${parsed.isValid}`);
        console.log(`    Input total: ${parsed.inputTotal}`);
        console.log(`    Output total: ${parsed.outputTotal}`);

        if (parsed.inputs && parsed.inputs.length > 0) {
          console.log(`    Inputs: ${parsed.inputs.length}`);
          parsed.inputs.slice(0, 2).forEach((input, i) => {
            console.log(`      [${i}] ${input.address}: ${input.amount}`);
          });
        }

        if (parsed.outputs && parsed.outputs.length > 0) {
          console.log(`    Outputs: ${parsed.outputs.length}`);
          parsed.outputs.slice(0, 2).forEach((output, i) => {
            console.log(`      [${i}] ${output.address}: ${output.amount}`);
          });
        }

        if (parsed.raw) {
          console.log(`    Raw data: Available (${parsed.raw.txHex.length} chars)`);
        }
      });

      if (result.results.length > 3) {
        console.log(`\n  ... and ${result.results.length - 3} more transactions`);
      }
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Test 7: HD Wallet Batch Scanning
async function testHDWalletBatchScanning() {
  console.log('\n=== Test 7: HD Wallet Batch Scanning ===\n');

  // For demo purposes, we'll generate a new mnemonic
  // In real usage, you'd use an existing mnemonic with actual funds
  const mnemonic = Mnee.HDWallet.generateMnemonic();
  const hdWallet = mnee.HDWallet(mnemonic, {
    derivationPath: "m/44'/236'/0'",
    cacheSize: 1000,
  });

  console.log('Generated mnemonic:', mnemonic);
  console.warn('\nNOTE: This is a newly generated wallet, so no activity will be found.');
  console.warn('Replace or use a different mnemonic');

  // Generate 50 addresses to scan
  const addresses = [];
  for (let i = 0; i < 25; i++) {
    addresses.push(hdWallet.deriveAddress(i, false).address); // receive
    addresses.push(hdWallet.deriveAddress(i, true).address); // change
  }

  console.log(`\nScanning ${addresses.length} HD wallet addresses...`);

  try {
    const batch = mnee.batch();
    const data = await batch.getAll(addresses, {
      historyLimit: 5,
      chunkSize: 10,
      concurrency: 5,
      onProgress: createProgressTracker('HD Scan'),
    });

    // Analyze results
    const fundedAddresses = data.balances.results.filter((b) => b.decimalAmount > 0);
    const addressesWithUtxos = data.utxos.results.filter((r) => r.utxos.length > 0);
    const addressesWithHistory = data.histories.results.filter((h) => h.history.length > 0);

    console.log('\nHD Wallet Scan Results:');
    console.log(`- Total addresses scanned: ${addresses.length}`);
    console.log(`- Addresses with balance: ${fundedAddresses.length}`);
    console.log(`- Addresses with UTXOs: ${addressesWithUtxos.length}`);
    console.log(`- Addresses with history: ${addressesWithHistory.length}`);

    // Calculate totals
    const totalBalance = data.balances.results.reduce((sum, b) => sum + b.decimalAmount, 0);
    const totalUtxos = data.utxos.results.reduce((sum, r) => sum + r.utxos.length, 0);
    const totalTxs = data.histories.results.reduce((sum, h) => sum + h.history.length, 0);

    console.log('\nWallet Totals:');
    console.log(`- Total balance: ${totalBalance} MNEE`);
    console.log(`- Total UTXOs: ${totalUtxos}`);
    console.log(`- Total transactions: ${totalTxs}`);

    if (fundedAddresses.length > 0) {
      console.log('\nFunded addresses (showing first 5):');
      fundedAddresses.slice(0, 5).forEach((b, idx) => {
        const utxoCount = data.utxos.results.find((u) => u.address === b.address)?.utxos.length || 0;
        const txCount = data.histories.results.find((h) => h.address === b.address)?.history.length || 0;
        const derivationInfo = addresses.indexOf(b.address);
        const isChange = derivationInfo % 2 === 1;
        const index = Math.floor(derivationInfo / 2);

        console.log(`  [${index}/${isChange ? 1 : 0}] ${b.address}:`);
        console.log(`    Balance: ${b.decimalAmount} MNEE, UTXOs: ${utxoCount}, TXs: ${txCount}`);
      });

      if (fundedAddresses.length > 5) {
        console.log(`  ... and ${fundedAddresses.length - 5} more funded addresses`);
      }
    } else {
      console.log('\n  No funded addresses found. This is a new wallet.');
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run all tests
async function runAllTests() {
  console.log('MNEE SDK - Batch Processing Tests');
  console.log('==================================');

  await testGetUtxosBatch();
  await testGetBalancesBatch();
  await testGetTxHistoriesBatch();
  await testGetAllDataBatch();
  await testErrorHandling();
  await testParseTxBatch();
  await testHDWalletBatchScanning();

  console.log('\n✅ All tests completed!');
}

// Execute tests
runAllTests().catch(console.error);
