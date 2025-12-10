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

// Test 15.1: Parse inscriptions from known transactions
async function testKnownTransactionInscriptions() {
  try {
    const transactions = knownTxs[config.environment];
    if (!transactions) {
      console.log(`  No known test transactions for ${config.environment} environment`);
      return;
    }

    for (const [type, txInfo] of Object.entries(transactions)) {
      console.log(`  Testing ${type} transaction: ${txInfo.txid}`);

      const parsed = await mnee.parseTx(txInfo.txid, { includeRaw: true });

      if (parsed.raw && parsed.raw.outputs) {
        let inscriptionCount = 0;

        for (const output of parsed.raw.outputs) {
          if (output.scriptPubKey) {
            try {
              const script = Script.fromHex(output.scriptPubKey);
              const inscription = mnee.parseInscription(script);

              if (inscription) {
                inscriptionCount++;

                // Verify inscription structure
                assert(inscription.file, 'Inscription should have file property');
                assert(inscription.file.hash, 'File should have hash');
                assert(typeof inscription.file.size === 'number', 'File should have size');
                assert(inscription.file.type, 'File should have type');
                assert(Array.isArray(inscription.file.content), 'File content should be array');

                // For MNEE inscriptions, verify the content
                if (inscription.file.type === 'application/bsv-20') {
                  const contentStr = Buffer.from(inscription.file.content).toString('utf8');
                  const mneeData = JSON.parse(contentStr);

                  assert(mneeData.p === 'bsv-20', 'Protocol should be bsv-20');
                  assert(mneeData.id, 'Should have token ID');
                  assert(mneeData.op, 'Should have operation');

                  if (type === 'transfer') {
                    assert(mneeData.op === 'transfer', 'Transfer should have transfer op');
                  } else if (type === 'mint') {
                    assert(mneeData.op === 'deploy+mint' || mneeData.op === 'mint', 'Mint should have mint op');
                  }
                }
              }
            } catch (e) {
              // Script parsing might fail for some outputs
            }
          }
        }

        if (txInfo.hasInscriptions) {
          assert(inscriptionCount > 0, `${type} transaction should have inscriptions`);
          console.log(`    Found ${inscriptionCount} inscriptions ✓`);
        } else {
          assert(inscriptionCount === 0, `${type} transaction should not have inscriptions`);
          console.log(`    No inscriptions as expected ✓`);
        }
      }
    }
  } catch (error) {
    console.log(`  Known transaction inscriptions error: ${error.message}`);
    throw error;
  }
}

// Test 15.2: Parse test scripts
async function testScriptInscriptions() {
  try {
    const testScripts = knownTxs.testScripts;

    for (const [name, scriptInfo] of Object.entries(testScripts)) {
      console.log(`  Testing ${name}: ${scriptInfo.description}`);

      if (scriptInfo.hex) {
        try {
          const script = Script.fromHex(scriptInfo.hex);
          const inscription = mnee.parseInscription(script);

          if (scriptInfo.hasInscription) {
            assert(inscription, `${name} should have inscription`);

            // Verify MNEE inscription content
            if (inscription.file && inscription.file.content) {
              const contentStr = Buffer.from(inscription.file.content).toString('utf8');
              const data = JSON.parse(contentStr);

              assert(data.p === 'bsv-20', 'Should be BSV-20 protocol');
              assert(data.op === 'transfer', 'Should be transfer operation');
              assert(data.amt, 'Should have amount');
              assert(data.id, 'Should have token ID');

              console.log(`    Found MNEE inscription with amount ${data.amt} ✓`);
            }
          } else {
            assert(!inscription, `${name} should not have inscription`);
            console.log(`    No inscription as expected ✓`);
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
    console.log(`  Test script inscriptions error: ${error.message}`);
    throw error;
  }
}

// Test 15.3: Parse raw transaction inscriptions
async function testRawTransactionInscriptions() {
  try {
    const rawTxs = knownTxs.rawTransactions;

    for (const [name, txInfo] of Object.entries(rawTxs)) {
      console.log(`  Testing ${name}: ${txInfo.description}`);

      const parsed = await mnee.parseTxFromRawTx(txInfo.hex, { includeRaw: true });

      if (parsed.raw && parsed.raw.outputs) {
        let inscriptionCount = 0;
        let mneeInscriptionCount = 0;

        for (const output of parsed.raw.outputs) {
          if (output.scriptPubKey) {
            try {
              const script = Script.fromHex(output.scriptPubKey);
              const inscription = mnee.parseInscription(script);

              if (inscription) {
                inscriptionCount++;

                if (inscription.file && inscription.file.content) {
                  try {
                    const contentStr = Buffer.from(inscription.file.content).toString('utf8');
                    const data = JSON.parse(contentStr);
                    if (data.p === 'bsv-20') {
                      mneeInscriptionCount++;
                    }
                  } catch (e) {
                    // Not a JSON inscription
                  }
                }
              }
            } catch (e) {
              // Script parsing error
            }
          }
        }

        if (txInfo.hasInscriptions) {
          assert(inscriptionCount > 0, `${name} should have inscriptions`);
          assert(
            inscriptionCount >= txInfo.expectedInscriptions,
            `${name} should have at least ${txInfo.expectedInscriptions} inscriptions`,
          );
          console.log(`    Found ${inscriptionCount} inscriptions (${mneeInscriptionCount} MNEE) ✓`);
        } else {
          assert(inscriptionCount === 0, `${name} should not have inscriptions`);
          console.log(`    No inscriptions as expected ✓`);
        }
      }
    }
  } catch (error) {
    console.log(`  Raw transaction inscriptions error: ${error.message}`);
    throw error;
  }
}

// Test 15.4: Verify inscription parsing edge cases
async function testInscriptionEdgeCases() {
  try {
    // Test empty script
    const emptyScript = new Script();
    const emptyInscription = mnee.parseInscription(emptyScript);
    assert(!emptyInscription, 'Empty script should not have inscription');
    console.log('  Empty script: No inscription ✓');

    // Test script with minimal chunks
    const minimalScript = new Script();
    minimalScript.chunks = [];
    const minimalInscription = mnee.parseInscription(minimalScript);
    assert(!minimalInscription, 'Minimal script should not have inscription');
    console.log('  Minimal script: No inscription ✓');

    // Test P2PKH script
    const p2pkhScript = Script.fromHex('76a91489abcdefabbaabbaabbaabbaabbaabbaabbaabba88ac');
    const p2pkhInscription = mnee.parseInscription(p2pkhScript);
    assert(!p2pkhInscription, 'P2PKH script should not have inscription');
    console.log('  P2PKH script: No inscription ✓');

    // Test OP_RETURN script
    const opReturnScript = Script.fromHex('6a0b48656c6c6f20576f726c64');
    const opReturnInscription = mnee.parseInscription(opReturnScript);
    assert(!opReturnInscription, 'OP_RETURN script should not have inscription');
    console.log('  OP_RETURN script: No inscription ✓');
  } catch (error) {
    console.log(`  Edge cases error: ${error.message}`);
    throw error;
  }
}

// Test 15.5: Test inscription content parsing
async function testInscriptionContentParsing() {
  try {
    // Create a transfer to get a fresh MNEE inscription
    const request = [
      {
        address: testConfig.addresses.emptyAddress,
        amount: 0.00001, // Minimal amount
      },
    ];

    const transfer = await mnee.transfer(request, testConfig.wallet.testWif, { broadcast: false });
    const parsed = await mnee.parseTxFromRawTx(transfer.rawtx, { includeRaw: true });

    let foundValidMneeInscription = false;

    if (parsed.raw && parsed.raw.outputs) {
      for (const output of parsed.raw.outputs) {
        if (output.scriptPubKey) {
          try {
            const script = Script.fromHex(output.scriptPubKey);
            const inscription = mnee.parseInscription(script);

            if (inscription && inscription.file && inscription.file.content) {
              // Verify file properties
              assert(inscription.file.hash, 'File should have hash');
              assert(inscription.file.size > 0, 'File should have non-zero size');
              assert(inscription.file.type, 'File should have type');

              // Try to parse as MNEE inscription
              try {
                const contentStr = Buffer.from(inscription.file.content).toString('utf8');
                const mneeData = JSON.parse(contentStr);

                if (mneeData.p === 'bsv-20') {
                  foundValidMneeInscription = true;

                  // Verify MNEE inscription structure
                  assert(mneeData.p === 'bsv-20', 'Protocol should be bsv-20');
                  assert(mneeData.op === 'transfer', 'Operation should be transfer');
                  assert(mneeData.id, 'Should have token ID');
                  assert(mneeData.amt, 'Should have amount');
                  assert(parseInt(mneeData.amt) > 0, 'Amount should be positive');

                  // Verify file type for MNEE
                  assert(
                    inscription.file.type === 'application/bsv-20',
                    'MNEE inscription should have correct content type',
                  );

                  console.log(`  Found valid MNEE inscription:`);
                  console.log(`    Protocol: ${mneeData.p}`);
                  console.log(`    Operation: ${mneeData.op}`);
                  console.log(`    Amount: ${mneeData.amt}`);
                  console.log(`    Token ID: ${mneeData.id.substring(0, 10)}...`);
                }
              } catch (e) {
                // Not a JSON inscription
              }
            }
          } catch (e) {
            // Script parsing error
          }
        }
      }
    }

    assert(foundValidMneeInscription, 'Should find at least one valid MNEE inscription');
    console.log('  ✓ Successfully parsed MNEE inscription content');
  } catch (error) {
    console.log(`  Inscription content parsing error: ${error.message}`);
    throw error;
  }
}

// Run tests
async function runTests() {
  console.log('Running parseInscription tests...\n');
  console.log('Note: This method parses inscription data from Bitcoin scripts.\n');

  try {
    // Fetch config first
    await mnee.config();

    console.log('Test 15.1: Parse inscriptions from known transactions');
    await testKnownTransactionInscriptions();
    console.log('✅ Test 15.1 passed\n');

    console.log('Test 15.2: Parse test scripts');
    await testScriptInscriptions();
    console.log('✅ Test 15.2 passed\n');

    console.log('Test 15.3: Parse raw transaction inscriptions');
    await testRawTransactionInscriptions();
    console.log('✅ Test 15.3 passed\n');

    console.log('Test 15.4: Verify inscription parsing edge cases');
    await testInscriptionEdgeCases();
    console.log('✅ Test 15.4 passed\n');

    console.log('Test 15.5: Test inscription content parsing');
    await testInscriptionContentParsing();
    console.log('✅ Test 15.5 passed\n');

    console.log('All tests passed! ✅');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
