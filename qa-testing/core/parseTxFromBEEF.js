import Mnee from '@mnee/ts-sdk';
// Transaction is a transitive dependency available via @mnee/ts-sdk → @bsv/sdk
import { Transaction } from '@bsv/sdk';
import assert from 'assert';
import testConfig from '../testConfig.js';

// Test configuration
const config = {
  environment: testConfig.environment,
  apiKey: testConfig.apiKey,
};

const mnee = new Mnee(config);

const TEST_ADDRESS = testConfig.addresses.testAddress;

// Known transaction IDs (same set used in parseTx.js and parseTxFromRawTx.js)
const knownTransactions = {
  sandbox: {
    deploy: '833a7720966a2a435db28d967385e8aa7284b6150ebb39482cc5228b73e1703f',
    mint: '9b42a339a97df37c8756a3425d4200ae2a592fd751c50e1d5ce0a1ddcab06b81',
    transfer: 'baa78cb903e0bf7af6e5fc5a27de59d587fc5ff4f08ed5e7886ab1a7d2741c5b',
    burn: 'e2421bb58ecb606c04e81a20943ea32eeac6c5c374d77d6dba7d46a2ddbad483',
    redeem: 'ebef149590fb45f080e372152fdb475cbba5a9c6f43374b48b02d063261848f3',
  },
  production: {
    deploy: 'ae59f3b898ec61acbdb6cc7a245fabeded0c094bf046f35206a3aec60ef88127',
    mint: 'f7ca34a9c0319bfb837a56ee7375e8246229f5fefbdaaaf9fdec97493d428bee',
    transfer: 'e496b2984a6b780a453559125540ec1e1c99154cdbc1cef2d2f6bea37d6dedd9',
  },
};

// ---------------------------------------------------------------------------
// Helper: given a txid, fetch its raw hex and as many parent transactions as
// the MNEE API will serve, then reconstruct a BEEF hex string.
//
// The MNEE indexer only serves MNEE-related transactions — plain BSV fee
// inputs and oversized MNEE distribution txs (e.g. 22000+ output mints) come
// back as HTTP 400/404. We embed what we can; parseTxFromBEEF tolerates the
// rest by marking those inputs as unknown.
// ---------------------------------------------------------------------------
async function txidToBEEF(txid) {
  const tx = await mnee.fetchSourceTransaction(txid);
  assert(tx, `Could not fetch raw transaction for txid ${txid}`);
  const rawtxHex = tx.toHex();

  let embedded = 0;
  let skipped = 0;
  for (const input of tx.inputs) {
    if (!input.sourceTXID) continue;
    await new Promise((r) => setTimeout(r, 150)); // rate-limit buffer
    try {
      const sourceTx = await mnee.fetchSourceTransaction(input.sourceTXID);
      if (sourceTx) {
        input.sourceTransaction = sourceTx;
        embedded++;
      } else {
        skipped++;
      }
    } catch {
      skipped++;
    }
  }
  if (skipped > 0) {
    console.log(`    BEEF parents: ${embedded} embedded, ${skipped} skipped (MNEE API doesn't serve them)`);
  }

  return { beefHex: tx.toHexBEEF(), rawtxHex };
}

// ---------------------------------------------------------------------------
// Helper: return a { txid, beefHex, rawtxHex } suitable for tests.
//
// Tries the most recent history entry first (exercises real-world data), but
// falls back to a known-good transaction when the history entry's parent txs
// are unavailable from the API (e.g. the parent is a coinbase or predates the
// API's index).  Results are cached so all tests in a single run share one set
// of fetches.
// ---------------------------------------------------------------------------
let _testBEEFCache = null;

async function getTestBEEF() {
  if (_testBEEFCache) return _testBEEFCache;

  // Try history first
  try {
    const txid = await getRecentTxidFromHistory();
    const { beefHex, rawtxHex } = await txidToBEEF(txid);
    _testBEEFCache = { txid, beefHex, rawtxHex };
    return _testBEEFCache;
  } catch (err) {
    console.log(`  History-based BEEF unavailable (${err.message}) — falling back to known transactions`);
  }

  // Fall back to a known transaction whose parents are guaranteed fetchable
  const transactions = knownTransactions[config.environment];
  if (!transactions) throw new Error(`No known transactions configured for environment "${config.environment}"`);
  const txid = transactions.transfer ?? Object.values(transactions)[0];
  const { beefHex, rawtxHex } = await txidToBEEF(txid);
  _testBEEFCache = { txid, beefHex, rawtxHex };
  return _testBEEFCache;
}

// ---------------------------------------------------------------------------
// Helper: get a recent transfer txid from the test address history
// ---------------------------------------------------------------------------
async function getRecentTxidFromHistory() {
  const history = await mnee.recentTxHistory(TEST_ADDRESS, undefined, 5);
  if (!history.history || history.history.length === 0) {
    throw new Error(`No transaction history found for test address ${TEST_ADDRESS}`);
  }
  return history.history[0].txid;
}

// ---------------------------------------------------------------------------
// Test 15.1: Parse a BEEF built from a recent transaction in the test address's history
// ---------------------------------------------------------------------------
async function testParseBEEFFromHistory() {
  try {
    const { txid, beefHex, rawtxHex } = await getTestBEEF();
    console.log(`  Using txid: ${txid.substring(0, 16)}...`);

    assert(beefHex && typeof beefHex === 'string', 'BEEF hex should be a non-empty string');
    assert(beefHex !== rawtxHex, 'BEEF hex should differ from plain raw tx hex');
    assert(beefHex.length > rawtxHex.length, 'BEEF hex should be longer (contains parent txs)');

    const parsedBEEF = await mnee.parseTxFromBEEF(beefHex);

    assert(parsedBEEF.txid === txid, 'Parsed txid should match the original');
    assert(parsedBEEF.environment === config.environment, `Environment should be ${config.environment}`);
    assert(Array.isArray(parsedBEEF.inputs), 'inputs should be an array');
    assert(Array.isArray(parsedBEEF.outputs), 'outputs should be an array');
    assert(typeof parsedBEEF.isValid === 'boolean', 'isValid should be boolean');
    assert(typeof parsedBEEF.inputTotal === 'string', 'inputTotal should be a string');
    assert(typeof parsedBEEF.outputTotal === 'string', 'outputTotal should be a string');

    console.log(`  Parsed BEEF from history transaction successfully ✓`);
    console.log(`  txid: ${parsedBEEF.txid.substring(0, 16)}...`);
    console.log(`  type: ${parsedBEEF.type}, valid: ${parsedBEEF.isValid}`);
    console.log(`  inputs: ${parsedBEEF.inputs.length}, outputs: ${parsedBEEF.outputs.length}`);
  } catch (error) {
    console.log(`  parseTxFromBEEF from history error: ${error.message}`);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Test 15.2: Parse BEEF with includeRaw option
// ---------------------------------------------------------------------------
async function testParseBEEFWithIncludeRaw() {
  try {
    const { txid, beefHex } = await getTestBEEF();

    const parsed = await mnee.parseTxFromBEEF(beefHex, { includeRaw: true });

    assert(parsed.txid === txid, 'Parsed txid should match');
    assert(parsed.raw, 'Should have raw field when includeRaw is true');
    assert(typeof parsed.raw.txHex === 'string' && parsed.raw.txHex.length > 0, 'raw.txHex should be non-empty');
    assert(Array.isArray(parsed.raw.inputs), 'raw.inputs should be an array');
    assert(Array.isArray(parsed.raw.outputs), 'raw.outputs should be an array');

    if (parsed.raw.inputs.length > 0) {
      const rawInput = parsed.raw.inputs[0];
      assert(typeof rawInput.vout === 'number', 'Raw input should have numeric vout');
      assert(typeof rawInput.sequence === 'number', 'Raw input should have numeric sequence');
      assert(typeof rawInput.satoshis === 'number', 'Raw input should have numeric satoshis');
    }

    if (parsed.raw.outputs.length > 0) {
      const rawOutput = parsed.raw.outputs[0];
      assert(typeof rawOutput.value === 'number', 'Raw output should have numeric value');
      assert(rawOutput.scriptPubKey, 'Raw output should have scriptPubKey');
    }

    console.log(`  Parsed BEEF with includeRaw successfully ✓`);
    console.log(`  raw.txHex length: ${parsed.raw.txHex.length} chars`);
    console.log(`  raw inputs: ${parsed.raw.inputs.length}, raw outputs: ${parsed.raw.outputs.length}`);
  } catch (error) {
    console.log(`  parseTxFromBEEF includeRaw error: ${error.message}`);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Test 15.3: parseTxFromBEEF and parseTxFromRawTx return identical results
// for the same transaction
// ---------------------------------------------------------------------------
async function testBEEFvsRawTxConsistency() {
  try {
    const { txid, beefHex, rawtxHex } = await getTestBEEF();

    // BEEF carries embedded parents, so its parse populates per-input token amounts
    // directly. parseTxFromRawTx defaults to the fast (no-fetch) path which leaves
    // per-input amounts at 0; pass skipInputFetch:false to fetch parents and produce
    // a comparable response.
    const [fromBEEF, fromRaw] = await Promise.all([
      mnee.parseTxFromBEEF(beefHex),
      mnee.parseTxFromRawTx(rawtxHex, { skipInputFetch: false }),
    ]);

    assert(fromBEEF.txid === fromRaw.txid, 'txid must match between BEEF and raw parsing');
    assert(fromBEEF.environment === fromRaw.environment, 'environment must match');
    assert(fromBEEF.type === fromRaw.type, 'type must match');
    assert(fromBEEF.isValid === fromRaw.isValid, 'isValid must match');
    assert(fromBEEF.inputTotal === fromRaw.inputTotal, 'inputTotal must match');
    assert(fromBEEF.outputTotal === fromRaw.outputTotal, 'outputTotal must match');
    assert(fromBEEF.inputs.length === fromRaw.inputs.length, 'input count must match');
    assert(fromBEEF.outputs.length === fromRaw.outputs.length, 'output count must match');

    for (let i = 0; i < fromBEEF.inputs.length; i++) {
      assert(fromBEEF.inputs[i].address === fromRaw.inputs[i].address, `Input ${i} address must match`);
      assert(fromBEEF.inputs[i].amount === fromRaw.inputs[i].amount, `Input ${i} amount must match`);
    }

    for (let i = 0; i < fromBEEF.outputs.length; i++) {
      assert(fromBEEF.outputs[i].address === fromRaw.outputs[i].address, `Output ${i} address must match`);
      assert(fromBEEF.outputs[i].amount === fromRaw.outputs[i].amount, `Output ${i} amount must match`);
    }

    console.log(`  parseTxFromBEEF and parseTxFromRawTx produce identical results ✓`);
    console.log(`  txid: ${fromBEEF.txid.substring(0, 16)}...`);
  } catch (error) {
    console.log(`  BEEF vs raw consistency error: ${error.message}`);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Test 15.4: BEEF parse completes fast — no network calls during parse itself
// (all parent txs are embedded, config is cached from SDK init)
// ---------------------------------------------------------------------------
async function testBEEFIsComputeOnly() {
  try {
    const { beefHex } = await getTestBEEF();

    // Ensure config is cached before timing
    await mnee.config();

    const start = Date.now();
    const parsed = await mnee.parseTxFromBEEF(beefHex);
    const elapsed = Date.now() - start;

    assert(parsed.txid, 'BEEF parse should succeed');

    // A purely compute-based parse (no network) should be well under 500ms.
    // parseTxFromRawTx would need to fetch N source txs at ~200ms each.
    assert(elapsed < 500, `parseTxFromBEEF took ${elapsed}ms — expected < 500ms for compute-only path`);

    console.log(`  parseTxFromBEEF completed in ${elapsed}ms (compute-only, no network calls) ✓`);
  } catch (error) {
    console.log(`  BEEF compute-only timing error: ${error.message}`);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Test 15.5: Known transaction types parse correctly from BEEF
// ---------------------------------------------------------------------------
async function testKnownTransactionTypesViaBEEF() {
  const transactions = knownTransactions[config.environment];
  if (!transactions) {
    console.log(`  No known transactions configured for ${config.environment} — skipping`);
    return;
  }

  console.log(`  Testing known ${config.environment} transactions via BEEF:`);

  for (const [type, txid] of Object.entries(transactions)) {
    try {
      const { beefHex } = await txidToBEEF(txid);
      const parsed = await mnee.parseTxFromBEEF(beefHex);

      assert(parsed.txid === txid, `txid should match for ${type}`);
      assert(parsed.type === type, `type should be '${type}', got '${parsed.type}'`);
      assert(parsed.environment === config.environment, `environment should match for ${type}`);

      console.log(`    ${type}: ${txid.substring(0, 16)}... ✓`);
    } catch (error) {
      console.log(`    ${type}: Failed — ${error.message}`);
      throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// Test 15.6: Empty string is rejected
// ---------------------------------------------------------------------------
async function testBEEFEmptyString() {
  let errorOccurred = false;
  try {
    await mnee.parseTxFromBEEF('');
  } catch (error) {
    errorOccurred = true;
    console.log(`  Empty string error: "${error.message}"`);
    assert(
      error.message.includes('valid BEEF') || error.message.includes('required'),
      'Error should mention invalid BEEF or required input',
    );
  }
  assert(errorOccurred, 'Empty string should cause an error');
}

// ---------------------------------------------------------------------------
// Test 15.7: Whitespace-only input is rejected
// ---------------------------------------------------------------------------
async function testBEEFWhitespaceInput() {
  let errorOccurred = false;
  try {
    await mnee.parseTxFromBEEF('   ');
  } catch (error) {
    errorOccurred = true;
    console.log(`  Whitespace input error: "${error.message}"`);
  }
  assert(errorOccurred, 'Whitespace-only input should cause an error');
}

// ---------------------------------------------------------------------------
// Test 15.8: Plain raw transaction hex is rejected (wrong format for BEEF)
// ---------------------------------------------------------------------------
async function testBEEFRejectsPlainRawHex() {
  let errorOccurred = false;
  const { rawtxHex } = await txidToBEEF(knownTransactions[config.environment]?.transfer
    || Object.values(knownTransactions[config.environment])[0]);
  try {
    await mnee.parseTxFromBEEF(rawtxHex);
  } catch (error) {
    errorOccurred = true;
    console.log(`  Plain raw hex rejected: "${error.message}"`);
    assert(
      error.message.includes('BEEF') || error.message.includes('deseriali') || error.message.includes('Invalid'),
      'Error should indicate invalid BEEF format',
    );
  }
  assert(errorOccurred, 'Plain raw tx hex should be rejected by parseTxFromBEEF');
}

// ---------------------------------------------------------------------------
// Test 15.9: Non-string (null) input is rejected
// ---------------------------------------------------------------------------
async function testBEEFNonStringInput() {
  let errorOccurred = false;
  try {
    await mnee.parseTxFromBEEF(null);
  } catch (error) {
    errorOccurred = true;
    console.log(`  Null input error: "${error.message}"`);
  }
  assert(errorOccurred, 'Null input should cause an error');
}

// Run tests
async function runTests() {
  console.log('Running parseTxFromBEEF tests...\n');
  console.log('Note: parseTxFromBEEF() is the purely compute-based parsing path.');
  console.log('BEEF (Bitcoin Extended Format) embeds parent transactions inline,');
  console.log('so input amounts and addresses resolve without any API calls.\n');
  console.log(`Using test address: ${TEST_ADDRESS}\n`);

  try {
    // Warm up the SDK config cache before any tests
    await mnee.config();

    console.log('Test 15.1: Parse BEEF built from a recent transaction in test address history');
    await testParseBEEFFromHistory();
    console.log('✅ Test 15.1 passed\n');

    console.log('Test 15.2: Parse BEEF with includeRaw option');
    await testParseBEEFWithIncludeRaw();
    console.log('✅ Test 15.2 passed\n');

    console.log('Test 15.3: parseTxFromBEEF and parseTxFromRawTx return identical results');
    await testBEEFvsRawTxConsistency();
    console.log('✅ Test 15.3 passed\n');

    console.log('Test 15.4: BEEF parse is compute-only (< 500ms, no network calls during parse)');
    await testBEEFIsComputeOnly();
    console.log('✅ Test 15.4 passed\n');

    console.log('Test 15.5: Known transaction types parse correctly from BEEF');
    await testKnownTransactionTypesViaBEEF();
    console.log('✅ Test 15.5 passed\n');

    console.log('Test 15.6: Empty string is rejected');
    await testBEEFEmptyString();
    console.log('✅ Test 15.6 passed\n');

    console.log('Test 15.7: Whitespace-only input is rejected');
    await testBEEFWhitespaceInput();
    console.log('✅ Test 15.7 passed\n');

    console.log('Test 15.8: Plain raw tx hex is rejected (not BEEF format)');
    await testBEEFRejectsPlainRawHex();
    console.log('✅ Test 15.8 passed\n');

    console.log('Test 15.9: Non-string (null) input is rejected');
    await testBEEFNonStringInput();
    console.log('✅ Test 15.9 passed\n');

    console.log('All tests passed! ✅');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
