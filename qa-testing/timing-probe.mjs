/**
 * Deeper timing probe — adds console.time() markers directly inside
 * the key methods of the installed dist package so we see exactly
 * where time is spent during parseTxFromBEEF.
 *
 * Approach: patch the minified dist after import via prototype walking.
 * Also probes the RateLimiter.execute() path to see if it's being hit.
 *
 * Run (with network):  node qa-testing/timing-probe.mjs
 * (needs MNEE API access — same env as the regular QA tests)
 */
import Mnee from '@mnee/ts-sdk';
import { Transaction } from '@bsv/sdk';
import testConfig from './testConfig.js';

const config = { environment: testConfig.environment, apiKey: testConfig.apiKey };
const mnee = new Mnee(config);
const TEST_ADDRESS = testConfig.addresses.testAddress;

// ─── helpers ────────────────────────────────────────────────────────────────

function lap(label) {
  const t0 = Date.now();
  return () => console.log(`  [timer] ${label}: ${Date.now() - t0}ms`);
}

// Walk prototype chain to find the real method, even on private-named props
function findMethod(obj, name) {
  let proto = obj;
  while (proto) {
    if (Object.prototype.hasOwnProperty.call(proto, name)) return proto;
    proto = Object.getPrototypeOf(proto);
  }
  return null;
}

// ─── patch the internal service ─────────────────────────────────────────────

function patchService(svc) {
  const proto = Object.getPrototypeOf(svc);

  // 1. processTransactionInputs
  if (typeof proto.processTransactionInputs === 'function') {
    const orig = proto.processTransactionInputs;
    proto.processTransactionInputs = async function (tx, ...rest) {
      // Inspect each input BEFORE processing
      let withSrc = 0, withoutSrc = 0;
      for (const inp of tx.inputs) {
        if (inp.sourceTransaction) withSrc++;
        else withoutSrc++;
      }
      console.log(`    processTransactionInputs: ${tx.inputs.length} inputs, `
        + `${withSrc} have sourceTransaction, ${withoutSrc} do NOT`);
      const t0 = Date.now();
      const res = await orig.call(this, tx, ...rest);
      console.log(`    processTransactionInputs done: ${Date.now() - t0}ms`);
      return res;
    };
    console.log('[patch] processTransactionInputs patched');
  } else {
    console.warn('[patch] processTransactionInputs NOT FOUND on prototype');
  }

  // 2. getConfig (private)
  if (typeof proto.getConfig === 'function') {
    const orig = proto.getConfig;
    proto.getConfig = async function () {
      const t0 = Date.now();
      const res = await orig.call(this);
      const dt = Date.now() - t0;
      if (dt > 5) console.log(`    getConfig: ${dt}ms (slow!)`);
      return res;
    };
    console.log('[patch] getConfig patched');
  }

  // 3. fetchRawTx — to see if any network call is made during parse
  if (typeof proto.fetchRawTx === 'function') {
    const orig = proto.fetchRawTx;
    proto.fetchRawTx = async function (txid, ...rest) {
      console.warn(`    ⚠ fetchRawTx called during parse! txid=${txid?.slice(0, 16)}...`);
      const t0 = Date.now();
      const res = await orig.call(this, txid, ...rest);
      console.warn(`    ⚠ fetchRawTx took ${Date.now() - t0}ms`);
      return res;
    };
    console.log('[patch] fetchRawTx patched');
  }
}

// ─── build BEEF from a live tx ──────────────────────────────────────────────

async function buildBEEF() {
  const history = await mnee.recentTxHistory(TEST_ADDRESS, undefined, 5);
  if (!history.history?.length) throw new Error('No history');
  const txid = history.history[0].txid;
  console.log(`Using txid: ${txid}`);

  const parsed = await mnee.parseTx(txid, { includeRaw: true });
  const tx = Transaction.fromHex(parsed.raw.txHex);

  console.log(`Main tx has ${tx.inputs.length} inputs`);
  for (const inp of tx.inputs) {
    if (inp.sourceTXID) {
      const src = await mnee.fetchSourceTransaction(inp.sourceTXID);
      if (src) inp.sourceTransaction = src;
    }
  }

  const beefHex = tx.toHexBEEF();
  console.log(`BEEF: ${beefHex.length} chars / ${(beefHex.length/2/1024).toFixed(1)} KB`);
  return { beefHex, txid };
}

// ─── main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n── Building BEEF (network OK here) ────────────────────────');
  const { beefHex, txid } = await buildBEEF();

  console.log('\n── Warming config ──────────────────────────────────────────');
  await mnee.config();
  console.log('Config warmed');

  // Patch the internal service
  const svc = mnee.service ?? mnee._service;
  if (svc) {
    console.log('\n── Patching internal service ───────────────────────────────');
    patchService(svc);
  } else {
    console.warn('Cannot find internal service; limited patching possible');
  }

  // Also inspect what fromHexBEEF gives us before calling parseTxFromBEEF
  console.log('\n── Inspecting BEEF round-trip ──────────────────────────────');
  {
    const t0 = Date.now();
    const reTx = Transaction.fromHexBEEF(beefHex);
    console.log(`fromHexBEEF: ${Date.now() - t0}ms`);
    let withSrc = 0, withoutSrc = 0;
    for (const inp of reTx.inputs) {
      if (inp.sourceTransaction) withSrc++;
      else withoutSrc++;
    }
    console.log(`Parsed tx inputs: ${reTx.inputs.length} total, `
      + `${withSrc} with sourceTransaction, ${withoutSrc} without`);
    console.log(`Expected txid: ${txid}`);
    console.log(`Parsed  txid: ${reTx.id('hex')}`);
  }

  console.log('\n── Timed parseTxFromBEEF ───────────────────────────────────');
  const t_start = Date.now();
  const result = await mnee.parseTxFromBEEF(beefHex);
  const elapsed = Date.now() - t_start;

  console.log(`\nparseTxFromBEEF total: ${elapsed}ms`);
  console.log(`txid: ${result.txid}`);
  console.log(`type: ${result.type}, valid: ${result.isValid}`);

  if (elapsed >= 500) {
    console.error(`\n❌ SLOW: ${elapsed}ms (expected < 500ms)`);
  } else {
    console.log(`\n✅ FAST: ${elapsed}ms`);
  }
}

main().catch(err => {
  console.error('Probe failed:', err.message);
  process.exit(1);
});
