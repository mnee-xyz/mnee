import Mnee from '../dist/index.modern.js';

// Sandbox configuration
const config = {
  environment: 'sandbox',
  // apiKey: 'your-sandbox-api-key' // Optional if you have one
};

// Create Mnee instance
const mnee = new Mnee(config);

// ===== CONFIGURATION - Replace these with your test values =====
// Test WIF with funds (you'll provide this)
const FUNDED_WIF = 'YOUR_FUNDED_WIF_HERE'; // Replace with a WIF that has sandbox MNEE tokens
const FUNDED_ADDRESS = 'YOUR_FUNDED_ADDRESS_HERE'; // Replace with the address of the funded WIF

// Test mnemonic for HD wallet (or generate a new one)
const TEST_MNEMONIC = Mnee.HDWallet.generateMnemonic();
console.log('Generated HD Wallet Mnemonic:', TEST_MNEMONIC);
console.log('Save this mnemonic to recover the wallet later!\n');

// ===== MAIN COMPREHENSIVE TEST =====
async function comprehensiveHDWalletTest() {
  console.log('=== COMPREHENSIVE HD WALLET TEST ===\n');

  try {
    // Step 1: Create HD wallet
    console.log('1. Creating HD Wallet...');
    const hdWallet = mnee.HDWallet(TEST_MNEMONIC, {
      derivationPath: "m/44'/236'/0'",
      cacheSize: 1000,
    });

    // Generate some addresses
    const addresses = await hdWallet.deriveAddresses(0, 5, false);
    const changeAddresses = await hdWallet.deriveAddresses(0, 3, true);

    console.log('Generated 5 receive addresses and 3 change addresses');
    console.log('First receive address:', addresses[0].address);
    console.log('First change address:', changeAddresses[0].address);

    // Step 2: Check initial configuration
    console.log('\n2. Checking MNEE configuration...');
    const mneeConfig = await mnee.config();
    console.log('Token ID:', mneeConfig?.tokenId);
    console.log('Decimals:', mneeConfig?.decimals);

    // Step 3: Fund HD wallet addresses from the provided WIF
    if (FUNDED_WIF !== 'YOUR_FUNDED_WIF_HERE') {
      console.log('\n3. Funding HD wallet addresses...');

      console.log('Funded address:', FUNDED_ADDRESS);
      const fundedBalance = await mnee.balance(FUNDED_ADDRESS);
      console.log('Funded address balance:', fundedBalance.decimalAmount, 'MNEE');

      if (fundedBalance.decimalAmount > 0) {
        // Send tokens to multiple HD addresses
        const transfers = [
          { address: addresses[0].address, amount: 0.5 },
          { address: addresses[1].address, amount: 1 },
          { address: addresses[2].address, amount: 0.25 },
          { address: changeAddresses[0].address, amount: 0.1 },
        ];

        console.log('\nSending tokens to HD addresses:');
        transfers.forEach((t) => console.log(`  - ${t.amount} MNEE to ${t.address}`));

        const transferResult = await mnee.transfer(transfers, FUNDED_WIF);

        if (transferResult.error) {
          console.error('Transfer failed:', transferResult.error);
        } else {
          console.log('✅ Transfer successful! TxID:', transferResult.txid);

          // Wait a moment for transaction to propagate
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    } else {
      throw new Error('Please provide a funded WIF and address');
    }

    // Step 4: Check balances using multiple methods
    console.log('\n4. Checking balances...');

    // Use the export function to get all funded addresses and balances
    const exportResult = await exportFundedAddresses(TEST_MNEMONIC, {
      maxReceiveAddresses: 10,
      maxChangeAddresses: 5,
      includePrivateKeys: false,
      format: 'json',
    });

    console.log('Total HD wallet balance:', exportResult.totalBalance, 'MNEE');
    console.log('Funded addresses:', exportResult.fundedAddresses.length);

    // Show first funded address as example
    if (exportResult.fundedAddresses.length > 0) {
      const first = exportResult.fundedAddresses[0];
      console.log(`Example - ${first.type} address #${first.index}: ${first.balance} MNEE`);
    }

    // Step 5: Get UTXOs
    console.log('\n5. Getting UTXOs...');
    // Get all addresses we generated
    const allAddresses = [...addresses.map((a) => a.address), ...changeAddresses.map((a) => a.address)];
    const utxos = await mnee.getUtxos(allAddresses);
    console.log('Found', utxos.length, 'UTXOs');

    if (utxos.length > 0) {
      console.log('First UTXO:');
      console.log('  - TxID:', utxos[0].txid);
      console.log('  - Amount:', mnee.fromAtomicAmount(utxos[0].data.bsv21.amt), 'MNEE');
      console.log('  - Owner:', utxos[0].owners[0]);
    }

    // Step 6: Transaction History
    console.log('\n6. Checking transaction history...');
    const fundedAddresses = exportResult.fundedAddresses.map((a) => a.address);

    if (fundedAddresses.length > 0) {
      // Single address history
      const history = await mnee.recentTxHistory(fundedAddresses[0], undefined, 10);
      console.log(`Transaction history for ${fundedAddresses[0]}:`);
      console.log('  - Transactions:', history.transactions?.length || 0);
      console.log('  - Has more:', history.nextScore !== null);

      // Multiple address histories
      const historyParams = fundedAddresses.slice(0, 3).map((addr) => ({
        address: addr,
        limit: 5,
      }));

      const histories = await mnee.recentTxHistories(historyParams);
      console.log('\nBatch history results:', histories.length, 'addresses checked');
    }

    // Step 7: Parse transactions
    console.log('\n7. Transaction parsing...');
    if (utxos.length > 0) {
      const txidToParse = utxos[0].txid;

      // Parse by txid
      const parsedTx = await mnee.parseTx(txidToParse);
      console.log('Parsed transaction:');
      console.log('  - TxID:', parsedTx.txid);
      console.log('  - Inputs:', parsedTx.inputs.length);
      console.log('  - Outputs:', parsedTx.outputs.length);

      // Parse with raw data
      const parsedTxExtended = await mnee.parseTx(txidToParse, { includeRaw: true });
      if ('rawTx' in parsedTxExtended) {
        console.log('  - Raw tx size:', parsedTxExtended.rawTx.length, 'chars');
      }
    }

    // Step 8: HD Wallet Recovery Demo
    console.log('\n8. HD Wallet Recovery...');

    // Create a new HD wallet instance from the same mnemonic
    const recoveredWallet = mnee.HDWallet(TEST_MNEMONIC, {
      derivationPath: "m/44'/236'/0'",
    });

    // Define function to check if address has been used
    const checkAddressUsed = async (address) => {
      const utxos = await mnee.getUtxos(address);
      return utxos.length > 0;
    };

    // Scan for used addresses with gap limit
    const scanResult = await recoveredWallet.scanAddressesWithGapLimit(checkAddressUsed, {
      gapLimit: 20,
      scanChange: true,
      maxScan: 100,
    });

    console.log('Recovery scan results:');
    console.log('  - Found', scanResult.receive.length, 'used receive addresses');
    console.log('  - Found', scanResult.change.length, 'used change addresses');

    // Step 9: Consolidation using transferMulti
    console.log('\n9. HD Wallet Consolidation...');

    if (utxos.length > 1) {
      // Use the sweep function to consolidate back to funding address
      const sweepResult = await sweepHDWallet(TEST_MNEMONIC, FUNDED_ADDRESS, {
        maxReceiveAddresses: 10,
        maxChangeAddresses: 5,
        showDetails: false,
      });

      if (sweepResult.success) {
        console.log('✅ Consolidation successful using sweep!');
        console.log('Transaction ID:', sweepResult.txid);
        console.log('Total swept:', sweepResult.totalSwept, 'MNEE');
        console.log('UTXOs consolidated:', sweepResult.utxosConsolidated);
      } else {
        console.error('Consolidation failed:', sweepResult.error);
      }
    }

    // Step 10: Advanced features
    console.log('\n10. Advanced Features...');

    // Amount conversions
    const humanAmount = 123.456;
    const atomicAmount = mnee.toAtomicAmount(humanAmount);
    console.log(`Amount conversion: ${humanAmount} MNEE = ${atomicAmount} atomic units`);
    console.log(`Reverse: ${atomicAmount} atomic = ${mnee.fromAtomicAmount(atomicAmount)} MNEE`);

    // Mnemonic validation
    console.log('\nMnemonic validation:');
    console.log('  - Test mnemonic valid:', Mnee.HDWallet.isValidMnemonic(TEST_MNEMONIC));
    console.log('  - Invalid mnemonic:', Mnee.HDWallet.isValidMnemonic('invalid phrase'));

    // Cache management
    console.log('\nHD Wallet cache:');
    console.log('  - Cache size:', recoveredWallet.getCacheSize());
    recoveredWallet.clearCache();
    console.log('  - After clear:', recoveredWallet.getCacheSize());

    // Step 11: Demonstrate all getPrivateKeys variations
    console.log('\n11. Private key retrieval methods...');

    if (fundedAddresses.length > 0) {
      // Method 1: Get private keys with paths
      const keysWithPaths = recoveredWallet.getPrivateKeysForAddresses(fundedAddresses.slice(0, 2), {
        maxScanReceive: 100,
        maxScanChange: 50,
        scanStrategy: 'parallel',
      });

      console.log('Retrieved with paths:');
      Object.entries(keysWithPaths.paths).forEach(([addr, path]) => {
        console.log(`  - ${addr.substring(0, 10)}... -> ${path}`);
      });

      // Method 2: Get just private keys (simplified)
      const justKeys = recoveredWallet.getPrivateKeys(fundedAddresses.slice(0, 2));
      console.log('\nRetrieved keys:', Object.keys(justKeys).length);
    }

    console.log('\n✅ Comprehensive test completed!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

// Export Funded Addresses with Details
async function exportFundedAddresses(mnemonic, options = {}) {
  const {
    derivationPath = "m/44'/236'/0'",
    maxReceiveAddresses = 100,
    maxChangeAddresses = 50,
    includePrivateKeys = false,
    format = 'json', // 'json' or 'csv'
  } = options;

  try {
    console.log('\n=== EXPORTING FUNDED ADDRESSES ===\n');

    // Create HD wallet
    const hdWallet = mnee.HDWallet(mnemonic, { derivationPath });

    // Derive addresses
    const receiveAddresses = await hdWallet.deriveAddresses(0, maxReceiveAddresses, false);
    const changeAddresses = await hdWallet.deriveAddresses(0, maxChangeAddresses, true);

    // Create address map for easy lookup
    const addressMap = new Map();
    receiveAddresses.forEach((info, i) => {
      addressMap.set(info.address, { ...info, type: 'receive', index: i });
    });
    changeAddresses.forEach((info, i) => {
      addressMap.set(info.address, { ...info, type: 'change', index: i });
    });

    const allAddresses = [...addressMap.keys()];

    // Get UTXOs and balances in parallel
    const [utxos, balances] = await Promise.all([mnee.getUtxos(allAddresses), mnee.balances(allAddresses)]);

    // Build funded address list
    const fundedAddresses = balances
      .filter((b) => b.decimalAmount > 0)
      .map((b) => {
        const info = addressMap.get(b.address);
        const addressUtxos = utxos.filter((u) => u.owners[0] === b.address);
        const utxoCount = addressUtxos.length;

        const result = {
          address: b.address,
          balance: b.decimalAmount,
          utxoCount,
          type: info.type,
          index: info.index,
          path: info.path,
        };

        if (includePrivateKeys) {
          result.privateKey = info.privateKey;
        }

        return result;
      })
      .sort((a, b) => b.balance - a.balance);

    const totalBalance = fundedAddresses.reduce((sum, a) => sum + a.balance, 0);

    console.log(`Found ${fundedAddresses.length} funded addresses`);
    console.log(`Total balance: ${totalBalance} MNEE`);
    console.log(`Total UTXOs: ${utxos.length}\n`);

    if (format === 'csv') {
      // CSV format output
      const headers = includePrivateKeys
        ? 'Address,Balance,UTXOs,Type,Index,Path,PrivateKey'
        : 'Address,Balance,UTXOs,Type,Index,Path';
      console.log('CSV Export:');
      console.log(headers);

      fundedAddresses.forEach((addr) => {
        const row = includePrivateKeys
          ? `${addr.address},${addr.balance},${addr.utxoCount},${addr.type},${addr.index},${addr.path},${addr.privateKey}`
          : `${addr.address},${addr.balance},${addr.utxoCount},${addr.type},${addr.index},${addr.path}`;
        console.log(row);
      });
    } else {
      // JSON format output
      console.log('JSON Export:');
      console.log(JSON.stringify(fundedAddresses, null, 2));
    }

    return {
      fundedAddresses,
      totalBalance,
      totalUTXOs: utxos.length,
      addressesChecked: allAddresses.length,
    };
  } catch (error) {
    console.error('❌ Export error:', error.message);
    return { error: error.message };
  }
}

// Standalone HD Wallet Sweep Function
async function sweepHDWallet(mnemonic, destinationAddress, options = {}) {
  const {
    derivationPath = "m/44'/236'/0'",
    maxReceiveAddresses = 100,
    maxChangeAddresses = 50,
    showDetails = true,
  } = options;

  try {
    console.log('\n=== HD WALLET SWEEP ===\n');

    // Create HD wallet from mnemonic
    const hdWallet = mnee.HDWallet(mnemonic, { derivationPath });

    // Step 1: Scan for addresses with UTXOs
    console.log('1. Scanning for addresses with UTXOs...');
    const addressesToCheck = [];

    // Check receive addresses
    for (let i = 0; i < maxReceiveAddresses; i++) {
      const addr = hdWallet.deriveAddress(i, false);
      addressesToCheck.push(addr.address);
    }

    // Check change addresses
    for (let i = 0; i < maxChangeAddresses; i++) {
      const addr = hdWallet.deriveAddress(i, true);
      addressesToCheck.push(addr.address);
    }

    // Get all UTXOs
    const utxos = await mnee.getUtxos(addressesToCheck);

    if (utxos.length === 0) {
      console.log('No UTXOs found in this HD wallet');
      return { success: false, message: 'No UTXOs found' };
    }

    console.log(`Found ${utxos.length} UTXOs`);

    // Step 2: Get unique addresses with UTXOs
    const utxoAddresses = [...new Set(utxos.map((u) => u.owners[0]))];
    console.log(`UTXOs found at ${utxoAddresses.length} addresses`);

    if (showDetails) {
      const balances = await mnee.balances(utxoAddresses);
      balances.forEach((b) => {
        if (b.decimalAmount > 0) {
          console.log(`  - ${b.address}: ${b.decimalAmount} MNEE`);
        }
      });
    }

    // Step 3: Get private keys
    console.log('\n2. Retrieving private keys...');
    const { privateKeys } = hdWallet.getPrivateKeysForAddresses(utxoAddresses);

    // Step 4: Build inputs
    const inputs = utxos.map((utxo) => ({
      txid: utxo.txid,
      vout: utxo.vout,
      wif: privateKeys[utxo.owners[0]],
    }));

    // Step 5: Calculate total amount
    const totalAtomic = utxos.reduce((sum, u) => sum + u.data.bsv21.amt, 0);
    const totalDecimal = mnee.fromAtomicAmount(totalAtomic);

    // Step 6: Get fee configuration
    console.log('\n3. Getting fee configuration...');
    const config = await mnee.config();

    // Find applicable fee tier based on total amount
    let feeAmount = 0.01; // Default fee
    if (config && config.fees) {
      const applicableFee = config.fees.find((tier) => totalDecimal >= tier.min && totalDecimal <= tier.max);
      if (applicableFee) {
        feeAmount = mnee.fromAtomicAmount(applicableFee.fee);
        console.log(`  - Using fee tier: ${applicableFee.min}-${applicableFee.max} MNEE`);
        console.log(`  - Fee amount: ${feeAmount} MNEE`);
      }
    }

    console.log(`\n4. Sweep Summary:`);
    console.log(`  - Total UTXOs: ${inputs.length}`);
    console.log(`  - Total amount: ${totalDecimal} MNEE`);
    console.log(`  - Destination: ${destinationAddress}`);
    console.log(`  - Fee: ${feeAmount} MNEE`);

    // Check if amount is sufficient
    if (totalDecimal <= feeAmount) {
      console.log(
        `\n⚠️  Warning: Total amount (${totalDecimal} MNEE) is not sufficient to cover fee (${feeAmount} MNEE)`,
      );
      return { success: false, error: 'Insufficient balance for fee' };
    }

    const recipientAmount = totalDecimal - feeAmount;
    console.log(`  - Amount to send: ${recipientAmount} MNEE`);

    // Step 7: Execute sweep
    console.log('\n5. Executing sweep...');
    const sweepResult = await mnee.transferMulti({
      inputs,
      recipients: [
        {
          address: destinationAddress,
          amount: recipientAmount,
        },
      ],
    });

    if (sweepResult.error) {
      console.error('❌ Sweep failed:', sweepResult.error);
      return { success: false, error: sweepResult.error };
    } else {
      console.log('✅ Sweep successful!');
      console.log('Transaction ID:', sweepResult.txid);
      return {
        success: true,
        txid: sweepResult.txid,
        totalSwept: totalDecimal,
        utxosConsolidated: inputs.length,
      };
    }
  } catch (error) {
    console.error('❌ Sweep error:', error.message);
    return { success: false, error: error.message };
  }
}

// Run the comprehensive test
console.log('MNEE SDK - Comprehensive HD Wallet Test\n');
console.log('Prerequisites:');
console.log('1. Replace FUNDED_WIF with a WIF that has sandbox MNEE tokens');
console.log('2. Run the test to see all SDK methods in action\n');

await comprehensiveHDWalletTest();
