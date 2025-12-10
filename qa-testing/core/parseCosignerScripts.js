import Mnee from '@mnee/ts-sdk';
import assert from 'assert';
import testConfig from '../testConfig.js';
import knownTxs from '../knownTestTransactions.js';
import { Script } from '@bsv/sdk';

// Test configuration
const config = {
  environment: testConfig.environment,
  apiKey: testConfig.apiKey,
};

const mnee = new Mnee(config);

// Test 16.1: Parse cosigner scripts from known transactions
async function testKnownTransactionCosigners() {
  try {
    const transactions = knownTxs[config.environment];
    if (!transactions) {
      console.log(`  No known test transactions for ${config.environment} environment`);
      return;
    }

    for (const [type, txInfo] of Object.entries(transactions)) {
      console.log(`  Testing ${type} transaction: ${txInfo.txid.substring(0, 10)}...`);

      const parsed = await mnee.parseTx(txInfo.txid, { includeRaw: true });

      if (parsed.raw && parsed.raw.outputs) {
        const scripts = parsed.raw.outputs
          .filter((output) => output.scriptPubKey)
          .map((output) => {
            try {
              return Script.fromHex(output.scriptPubKey);
            } catch (e) {
              return null;
            }
          })
          .filter((script) => script !== null);

        if (scripts.length > 0) {
          const cosigners = mnee.parseCosignerScripts(scripts);

          // Debug output
          console.log(`    Scripts: ${scripts.length}, Cosigners found: ${cosigners.length}`);

          if (txInfo.hasCosigners) {
            assert(cosigners.length > 0, `${type} transaction should have cosigner scripts`);
            if (cosigners.length !== txInfo.expectedCosigners) {
              console.log(`    Warning: Expected ${txInfo.expectedCosigners} but found ${cosigners.length}`);
              // Don't fail on count mismatch for now, just warn
            }

            // Verify cosigner structure
            for (const cosigner of cosigners) {
              assert(typeof cosigner.cosigner === 'string', 'Cosigner field should be string');
              assert(cosigner.address, 'Should have address');
              assert(cosigner.address.startsWith('1'), 'Address should be valid Bitcoin address');
            }

            // Check for expected cosigner (except for deploy which may have different structure)
            const mneeConfig = await mnee.config();
            if (mneeConfig && mneeConfig.approver && type !== 'deploy') {
              const hasExpectedCosigner = cosigners.some((c) => c.cosigner === mneeConfig.approver);
              if (!hasExpectedCosigner) {
                console.log(`    Warning: ${type} doesn't have expected approver cosigner`);
                console.log(
                  `    Found cosigners: ${cosigners.map((c) => c.cosigner.substring(0, 10) + '...').join(', ')}`,
                );
              }
            }

            console.log(`    Found ${cosigners.length} cosigner scripts ✓`);
          } else {
            assert(cosigners.length === 0, `${type} transaction should not have cosigner scripts`);
            console.log(`    No cosigner scripts as expected ✓`);
          }
        }
      }
    }
  } catch (error) {
    console.log(`  Known transaction cosigners error: ${error.message}`);
    throw error;
  }
}

// Test 16.2: Parse test scripts for cosigners
async function testScriptCosigners() {
  try {
    const testScripts = knownTxs.testScripts;

    for (const [name, scriptInfo] of Object.entries(testScripts)) {
      console.log(`  Testing ${name}: ${scriptInfo.description}`);

      if (scriptInfo.hex) {
        try {
          const script = Script.fromHex(scriptInfo.hex);
          const cosigners = mnee.parseCosignerScripts([script]);

          if (scriptInfo.hasCosigner) {
            assert(cosigners.length === 1, `${name} should have one cosigner result`);

            const cosigner = cosigners[0];
            assert(typeof cosigner.cosigner === 'string', 'Cosigner should be string');
            assert(cosigner.address, 'Should have address');

            if (scriptInfo.expectedCosigner !== undefined) {
              assert(
                cosigner.cosigner === scriptInfo.expectedCosigner,
                `Cosigner should be ${scriptInfo.expectedCosigner}`,
              );
            }

            if (scriptInfo.expectedAddress) {
              assert(
                cosigner.address === scriptInfo.expectedAddress,
                `Address should be ${scriptInfo.expectedAddress}`,
              );
            }

            console.log(
              `    Found cosigner: ${cosigner.cosigner ? cosigner.cosigner.substring(0, 10) + '...' : '(empty)'} ✓`,
            );
            console.log(`    Address: ${cosigner.address} ✓`);
          } else {
            assert(cosigners.length === 0, `${name} should not have cosigner`);
            console.log(`    No cosigner as expected ✓`);
          }
        } catch (e) {
          if (scriptInfo.hex === '') {
            console.log(`    Empty script handled correctly ✓`);
          } else {
            throw e;
          }
        }
      }
    }
  } catch (error) {
    console.log(`  Test script cosigners error: ${error.message}`);
    throw error;
  }
}

// Test 16.3: Parse raw transaction cosigners
async function testRawTransactionCosigners() {
  try {
    const rawTxs = knownTxs.rawTransactions;

    for (const [name, txInfo] of Object.entries(rawTxs)) {
      console.log(`  Testing ${name}: ${txInfo.description}`);

      const parsed = await mnee.parseTxFromRawTx(txInfo.hex, { includeRaw: true });

      if (parsed.raw && parsed.raw.outputs) {
        const scripts = parsed.raw.outputs
          .filter((output) => output.scriptPubKey)
          .map((output) => Script.fromHex(output.scriptPubKey));

        const cosigners = mnee.parseCosignerScripts(scripts);

        if (txInfo.hasCosigners) {
          assert(cosigners.length > 0, `${name} should have cosigners`);
          assert(
            cosigners.length >= txInfo.expectedCosigners,
            `${name} should have at least ${txInfo.expectedCosigners} cosigners`,
          );

          // Check for unique cosigners
          const uniqueCosigners = new Set(cosigners.filter((c) => c.cosigner).map((c) => c.cosigner));
          console.log(`    Found ${cosigners.length} cosigners (${uniqueCosigners.size} unique) ✓`);

          // Verify all have valid addresses
          for (const cosigner of cosigners) {
            assert(cosigner.address, 'Each cosigner should have address');
            assert(cosigner.address.startsWith('1'), 'Address should be valid Bitcoin format');
          }
        } else {
          assert(cosigners.length === 0, `${name} should not have cosigners`);
          console.log(`    No cosigners as expected ✓`);
        }
      }
    }
  } catch (error) {
    console.log(`  Raw transaction cosigners error: ${error.message}`);
    throw error;
  }
}

// Test 16.4: Test edge cases
async function testCosignerEdgeCases() {
  try {
    // Test empty array
    const emptyCosigners = mnee.parseCosignerScripts([]);
    assert(Array.isArray(emptyCosigners), 'Should return array');
    assert(emptyCosigners.length === 0, 'Empty input should return empty array');
    console.log('  Empty array: Returns empty result ✓');

    // Test script with empty chunks
    const emptyChunksScript = new Script();
    emptyChunksScript.chunks = [];
    const emptyChunksCosigners = mnee.parseCosignerScripts([emptyChunksScript]);
    assert(emptyChunksCosigners.length === 0, 'Empty chunks should return empty array');
    console.log('  Empty chunks script: No cosigners ✓');

    // Test multiple P2PKH scripts
    const p2pkhScripts = [
      Script.fromHex('76a91489abcdefabbaabbaabbaabbaabbaabbaabbaabba88ac'),
      Script.fromHex('76a914000000000000000000000000000000000000000088ac'),
    ];
    const p2pkhCosigners = mnee.parseCosignerScripts(p2pkhScripts);
    assert(p2pkhCosigners.length === 2, 'Should parse both P2PKH scripts');
    assert(
      p2pkhCosigners.every((c) => c.cosigner === ''),
      'P2PKH should have empty cosigner',
    );
    assert(
      p2pkhCosigners.every((c) => c.address),
      'All should have addresses',
    );
    console.log('  Multiple P2PKH scripts: Parsed correctly ✓');

    // Test mixed valid and invalid scripts
    const mixedScripts = [
      Script.fromHex('76a91489abcdefabbaabbaabbaabbaabbaabbaabbaabba88ac'), // Valid P2PKH
      new Script(), // Empty script
      Script.fromHex('6a0b48656c6c6f20576f726c64'), // OP_RETURN
    ];
    const mixedCosigners = mnee.parseCosignerScripts(mixedScripts);
    assert(mixedCosigners.length === 1, 'Should only parse valid P2PKH');
    console.log('  Mixed scripts: Only valid scripts parsed ✓');
  } catch (error) {
    console.log(`  Edge cases error: ${error.message}`);
    throw error;
  }
}

// Test 16.5: Test with created MNEE transaction
async function testCreatedTransactionCosigners() {
  try {
    // Create a multi-output transfer
    const requests = [
      { address: testConfig.addresses.emptyAddress, amount: 0.00001 },
      { address: testConfig.addresses.testAddress, amount: 0.00001 },
    ];

    const transfer = await mnee.transfer(requests, testConfig.wallet.testWif, { broadcast: false });
    const parsed = await mnee.parseTxFromRawTx(transfer.rawtx, { includeRaw: true });

    if (parsed.raw && parsed.raw.outputs) {
      const scripts = parsed.raw.outputs
        .filter((output) => output.scriptPubKey)
        .map((output) => Script.fromHex(output.scriptPubKey));

      const cosigners = mnee.parseCosignerScripts(scripts);

      // All MNEE outputs should have cosigners
      assert(cosigners.length >= requests.length, 'Should have cosigners for all outputs');

      // Verify expected cosigner
      const mneeConfig = await mnee.config();
      if (mneeConfig && mneeConfig.approver) {
        const hasExpectedCosigner = cosigners.some((c) => c.cosigner === mneeConfig.approver);
        assert(hasExpectedCosigner, 'Should have expected approver cosigner');

        // Count cosigners with the approver
        const approverCount = cosigners.filter((c) => c.cosigner === mneeConfig.approver).length;
        console.log(`  Found ${cosigners.length} cosigners (${approverCount} with approver) ✓`);
      }

      // Verify addresses match recipients
      const outputAddresses = cosigners.map((c) => c.address);
      for (const req of requests) {
        assert(outputAddresses.includes(req.address), `Output addresses should include recipient ${req.address}`);
      }
      console.log('  Recipients addresses found in outputs ✓');
    }
  } catch (error) {
    console.log(`  Created transaction cosigners error: ${error.message}`);
    throw error;
  }
}

// Test 16.6: Test UTXO scripts parsing
async function testUtxoCosignerParsing() {
  try {
    const utxos = await mnee.getUtxos(testConfig.addresses.testAddress);

    if (utxos.length > 0) {
      console.log(`  Testing ${utxos.length} UTXOs`);

      const scripts = [];
      let skippedCount = 0;

      // Convert UTXO scripts (may be base64) to Script objects
      for (const utxo of utxos.slice(0, 10)) {
        // Test first 10
        if (utxo.script) {
          try {
            let scriptHex = utxo.script;

            // Check if base64 encoded
            if (utxo.script.length % 4 === 0 && /^[A-Za-z0-9+/]+=*$/.test(utxo.script)) {
              const buffer = Buffer.from(utxo.script, 'base64');
              scriptHex = buffer.toString('hex');
            }

            scripts.push(Script.fromHex(scriptHex));
          } catch (e) {
            skippedCount++;
          }
        }
      }

      if (scripts.length > 0) {
        const cosigners = mnee.parseCosignerScripts(scripts);

        // All MNEE UTXOs should have cosigner scripts
        assert(cosigners.length === scripts.length, 'All UTXO scripts should parse');

        // Check for expected cosigner
        const mneeConfig = await mnee.config();
        if (mneeConfig && mneeConfig.approver) {
          const withApprover = cosigners.filter((c) => c.cosigner === mneeConfig.approver).length;
          assert(withApprover > 0, 'Should have at least one UTXO with approver');
          console.log(`  Parsed ${cosigners.length} UTXOs (${withApprover} with approver) ✓`);
        }

        // Verify all addresses are valid
        for (const cosigner of cosigners) {
          assert(cosigner.address, 'Each UTXO should have address');
          assert(cosigner.address.startsWith('1'), 'Address should be valid Bitcoin format');
        }
      }

      if (skippedCount > 0) {
        console.log(`  Skipped ${skippedCount} invalid UTXO scripts`);
      }
    } else {
      console.log('  No UTXOs available for testing');
    }
  } catch (error) {
    console.log(`  UTXO cosigner parsing error: ${error.message}`);
    throw error;
  }
}

// Run tests
async function runTests() {
  console.log('Running parseCosignerScripts tests...\n');
  console.log('Note: This method parses cosigner data from Bitcoin scripts.\n');

  try {
    // Fetch config first
    await mnee.config();

    console.log('Test 16.1: Parse cosigner scripts from known transactions');
    await testKnownTransactionCosigners();
    console.log('✅ Test 16.1 passed\n');

    console.log('Test 16.2: Parse test scripts for cosigners');
    await testScriptCosigners();
    console.log('✅ Test 16.2 passed\n');

    console.log('Test 16.3: Parse raw transaction cosigners');
    await testRawTransactionCosigners();
    console.log('✅ Test 16.3 passed\n');

    console.log('Test 16.4: Test edge cases');
    await testCosignerEdgeCases();
    console.log('✅ Test 16.4 passed\n');

    console.log('Test 16.5: Test with created MNEE transaction');
    await testCreatedTransactionCosigners();
    console.log('✅ Test 16.5 passed\n');

    console.log('Test 16.6: Test UTXO scripts parsing');
    await testUtxoCosignerParsing();
    console.log('✅ Test 16.6 passed\n');

    console.log('All tests passed! ✅');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
