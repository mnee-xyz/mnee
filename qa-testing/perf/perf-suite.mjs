// MNEE SDK performance suite.
//
// Runs each public SDK method N times and reports per-method timing
// statistics (count, min, mean, p50, p95, p99, max).
//
// Usage:
//   node qa-testing/perf/perf-suite.mjs
//   node qa-testing/perf/perf-suite.mjs --iters 20
//   node qa-testing/perf/perf-suite.mjs --include-mutating
//   node qa-testing/perf/perf-suite.mjs --out qa-testing/perf/report.json
//
// Flags:
//   --iters N              iterations per method (default 10)
//   --gap MS               sleep between network calls (default 350ms, ~3 req/s)
//   --include-mutating     include transfer / transferMulti / submitRawTx
//                          (consumes sandbox funds — opt-in only)
//   --skip-batch           skip batch-helper methods
//   --skip-hd              skip HDWallet methods
//   --out PATH             write JSON report to PATH

import Mnee from '@mnee/ts-sdk';
import { Script, Transaction } from '@bsv/sdk';
import testConfig from '../testConfig.js';
import { Recorder, repeat, time } from './perfTimer.js';

// ─── CLI args ──────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { iters: 10, gap: 350, includeMutating: false, skipBatch: false, skipHd: false, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--iters') args.iters = parseInt(argv[++i], 10);
    else if (a === '--gap') args.gap = parseInt(argv[++i], 10);
    else if (a === '--include-mutating') args.includeMutating = true;
    else if (a === '--skip-batch') args.skipBatch = true;
    else if (a === '--skip-hd') args.skipHd = true;
    else if (a === '--out') args.out = argv[++i];
    else if (a === '-h' || a === '--help') {
      console.log('See header comment in perf-suite.mjs for flag reference.');
      process.exit(0);
    }
  }
  if (!Number.isFinite(args.iters) || args.iters < 1) {
    throw new Error('--iters must be a positive integer');
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

const header = (s) => console.log(`\n${COLORS.bright}${COLORS.cyan}${s}${COLORS.reset}`);
const note = (s) => console.log(`${COLORS.dim}${s}${COLORS.reset}`);

// ─── setup ─────────────────────────────────────────────────────────────────
const sdkConfig = { environment: testConfig.environment, apiKey: testConfig.apiKey };
const mnee = new Mnee(sdkConfig);
const rec = new Recorder();

const TEST_ADDRESS = testConfig.addresses.testAddress;
const TEST_ADDRESSES = [
  testConfig.addresses.testAddress,
  testConfig.addresses.emptyAddress,
  '1ERN5r4A8Ur6T4XQgaxQLmWtRAmusga5xZ',
  '159zQuZRmHUrZArYTFgogQxndrAeSsbTtJ',
  '1Q9gVBxBdu7hmRv7KJg8mRFcSCTNNH8JdZ',
];
const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

// Build BEEF for a txid by embedding parents the API can serve.
async function buildBEEFFromTxid(txid) {
  const tx = await mnee.fetchSourceTransaction(txid);
  if (!tx) throw new Error(`Could not fetch raw tx for ${txid}`);
  const rawHex = tx.toHex();
  for (const input of tx.inputs) {
    if (!input.sourceTXID) continue;
    await new Promise((r) => setTimeout(r, 150));
    try {
      const src = await mnee.fetchSourceTransaction(input.sourceTXID);
      if (src) input.sourceTransaction = src;
    } catch {
      /* tolerate missing parents */
    }
  }
  return { beefHex: tx.toHexBEEF(), rawHex };
}

// Fetch a recent live txid from the test address history for parse/BEEF.
async function gatherFixtures() {
  note('Gathering fixtures (recent tx, raw hex, BEEF hex, scripts) …');
  const history = await mnee.recentTxHistory(TEST_ADDRESS, undefined, 5);
  if (!history.history?.length) {
    throw new Error(`No recent history for ${TEST_ADDRESS} — cannot build fixtures`);
  }
  const txid = history.history[0].txid;

  const parsedFull = await mnee.parseTx(txid, { includeRaw: true });
  const rawHex = parsedFull.raw?.txHex;
  if (!rawHex) throw new Error('parseTx did not return raw.txHex');

  // BEEF — reuse rawHex if API parents are unfetchable
  let beefHex;
  try {
    beefHex = (await buildBEEFFromTxid(txid)).beefHex;
  } catch (err) {
    console.log(`  ${COLORS.yellow}BEEF build failed (${err.message}) — parseTxFromBEEF will be skipped${COLORS.reset}`);
    beefHex = null;
  }

  // Inscription / cosigner script samples from the parsed tx outputs
  const inscriptionScripts = [];
  const cosignerScripts = [];
  for (const out of parsedFull.raw?.outputs ?? []) {
    if (!out.scriptPubKey) continue;
    try {
      const script = Script.fromHex(out.scriptPubKey);
      inscriptionScripts.push(script);
      cosignerScripts.push(script);
    } catch {
      /* skip malformed */
    }
    if (inscriptionScripts.length >= 5) break;
  }

  // Resolve a known transferable ticket — getTxStatus needs *something*
  // to call; we won't have a real ticketId without a fresh submit, so we
  // probe with the txid string and tolerate the resulting error.
  const probeTicket = txid;

  return { txid, rawHex, beefHex, inscriptionScripts, cosignerScripts, probeTicket };
}

// ─── run ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(`${COLORS.bright}MNEE SDK Performance Suite${COLORS.reset}`);
  console.log(`environment: ${COLORS.cyan}${testConfig.environment}${COLORS.reset}`);
  console.log(`iters/method: ${COLORS.cyan}${args.iters}${COLORS.reset}    gap: ${args.gap}ms    mutating: ${args.includeMutating ? 'INCLUDED' : 'skipped'}`);
  console.log('─'.repeat(60));

  // Warm config so first-call latency doesn't skew other methods
  note('Warming config cache …');
  await mnee.config();

  const fx = await gatherFixtures();

  // ─── pure / sync methods (no rate-limit needed) ──────────────────────────
  header('Pure helpers (no network)');

  await repeat(rec, 'toAtomicAmount', () => mnee.toAtomicAmount(1.5), { iters: args.iters });
  await repeat(rec, 'fromAtomicAmount', () => mnee.fromAtomicAmount(150000), { iters: args.iters });

  if (fx.inscriptionScripts.length > 0) {
    await repeat(rec, 'parseInscription', () => mnee.parseInscription(fx.inscriptionScripts[0]), {
      iters: args.iters,
    });
    await repeat(rec, 'parseCosignerScripts', () => mnee.parseCosignerScripts(fx.cosignerScripts), {
      iters: args.iters,
    });
  } else {
    rec.skip('parseInscription', 'no script fixtures available');
    rec.skip('parseCosignerScripts', 'no script fixtures available');
  }

  // ─── network reads (rate-limited) ────────────────────────────────────────
  header('Config');
  await repeat(rec, 'config', () => mnee.config(), { iters: args.iters, gapMs: args.gap });

  if (args.includeMutating) {
    await repeat(rec, 'refreshConfig', () => mnee.refreshConfig(), { iters: args.iters, gapMs: args.gap });
  } else {
    rec.skip('refreshConfig', 'mutates cache — opt-in via --include-mutating');
  }

  header('Balance / UTXO reads');
  await repeat(rec, 'balance', () => mnee.balance(TEST_ADDRESS), { iters: args.iters, gapMs: args.gap });
  await repeat(rec, 'balances', () => mnee.balances(TEST_ADDRESSES.slice(0, 3)), {
    iters: args.iters,
    gapMs: args.gap,
  });
  await repeat(rec, 'getUtxos', () => mnee.getUtxos(TEST_ADDRESS, 1, 50), {
    iters: args.iters,
    gapMs: args.gap,
  });
  await repeat(rec, 'getAllUtxos', () => mnee.getAllUtxos(TEST_ADDRESS), {
    iters: args.iters,
    gapMs: args.gap,
  });
  await repeat(rec, 'getEnoughUtxos', () => mnee.getEnoughUtxos(TEST_ADDRESS, 1), {
    iters: args.iters,
    gapMs: args.gap,
  });

  header('History reads');
  await repeat(rec, 'recentTxHistory', () => mnee.recentTxHistory(TEST_ADDRESS, undefined, 10), {
    iters: args.iters,
    gapMs: args.gap,
  });
  await repeat(
    rec,
    'recentTxHistories',
    () =>
      mnee.recentTxHistories(
        TEST_ADDRESSES.slice(0, 3).map((address) => ({ address, limit: 5 })),
      ),
    { iters: args.iters, gapMs: args.gap },
  );

  header('Parse / validate');
  await repeat(rec, 'parseTx', () => mnee.parseTx(fx.txid), { iters: args.iters, gapMs: args.gap });
  await repeat(rec, 'parseTxFromRawTx', () => mnee.parseTxFromRawTx(fx.rawHex), {
    iters: args.iters,
    gapMs: args.gap,
  });
  if (fx.beefHex) {
    // parseTxFromBEEF is compute-only — no rate limit needed
    await repeat(rec, 'parseTxFromBEEF', () => mnee.parseTxFromBEEF(fx.beefHex), { iters: args.iters });
  } else {
    rec.skip('parseTxFromBEEF', 'BEEF fixture unavailable');
  }
  await repeat(rec, 'validateMneeTx', () => mnee.validateMneeTx(fx.rawHex), {
    iters: args.iters,
    gapMs: args.gap,
  });

  header('Transaction status');
  await repeat(
    rec,
    'getTxStatus',
    async () => {
      try {
        await mnee.getTxStatus(fx.probeTicket);
      } catch {
        /* probe ticket likely 404s — we're measuring round-trip cost either way */
      }
    },
    { iters: args.iters, gapMs: args.gap },
  );

  await repeat(rec, 'fetchSourceTransaction', () => mnee.fetchSourceTransaction(fx.txid), {
    iters: args.iters,
    gapMs: args.gap,
  });

  // ─── mutating methods (opt-in) ───────────────────────────────────────────
  header('Mutating operations');
  if (args.includeMutating) {
    note('Mutating ops require sandbox funds — running 1 iter each (forced).');
    const wif = testConfig.wallet?.testWif;
    if (!wif) {
      rec.skip('transfer', 'no wif in testConfig');
      rec.skip('submitRawTx', 'no wif in testConfig');
    } else {
      await repeat(
        rec,
        'transfer',
        () => mnee.transfer([{ address: TEST_ADDRESS, amount: 0.00001 }], wif),
        { iters: 1, gapMs: args.gap },
      );
      // submitRawTx / transferMulti require freshly built txs — left as
      // a stub the user can wire in with project-specific fixtures.
      rec.skip('submitRawTx', 'requires a fresh signed raw tx fixture');
      rec.skip('transferMulti', 'requires multi-source UTXO fixture');
    }
  } else {
    rec.skip('transfer', 'mutating — opt-in via --include-mutating');
    rec.skip('transferMulti', 'mutating — opt-in via --include-mutating');
    rec.skip('submitRawTx', 'mutating — opt-in via --include-mutating');
  }

  // ─── HD wallet ───────────────────────────────────────────────────────────
  if (!args.skipHd) {
    header('HDWallet');
    await repeat(rec, 'HDWallet.generateMnemonic', () => Mnee.HDWallet.generateMnemonic(), {
      iters: args.iters,
    });
    await repeat(
      rec,
      'HDWallet.isValidMnemonic',
      () => Mnee.HDWallet.isValidMnemonic(TEST_MNEMONIC),
      { iters: args.iters },
    );
    await repeat(
      rec,
      'mnee.HDWallet(create)',
      () => mnee.HDWallet(TEST_MNEMONIC, { derivationPath: "m/44'/236'/0'", cacheSize: 100 }),
      { iters: args.iters },
    );

    const hd = mnee.HDWallet(TEST_MNEMONIC, { derivationPath: "m/44'/236'/0'", cacheSize: 1000 });
    if (typeof hd.deriveAddress === 'function') {
      let i = 0;
      await repeat(rec, 'HDWallet.deriveAddress', () => hd.deriveAddress(i++), { iters: args.iters });
    } else if (typeof hd.getAddress === 'function') {
      let i = 0;
      await repeat(rec, 'HDWallet.getAddress', () => hd.getAddress(0, i++), { iters: args.iters });
    } else {
      rec.skip('HDWallet.deriveAddress', 'method not exposed on HDWallet instance');
    }
  }

  // ─── batch helper ────────────────────────────────────────────────────────
  if (!args.skipBatch) {
    header('Batch helper');
    const batch = mnee.batch();
    if (typeof batch.getBalances === 'function') {
      await repeat(rec, 'batch.getBalances', () => batch.getBalances(TEST_ADDRESSES), {
        iters: args.iters,
        gapMs: args.gap,
      });
    }
    if (typeof batch.getUtxos === 'function') {
      await repeat(rec, 'batch.getUtxos', () => batch.getUtxos(TEST_ADDRESSES), {
        iters: args.iters,
        gapMs: args.gap,
      });
    }
    if (typeof batch.getTxHistories === 'function') {
      await repeat(
        rec,
        'batch.getTxHistories',
        () => batch.getTxHistories(TEST_ADDRESSES.map((address) => ({ address, limit: 5 }))),
        { iters: args.iters, gapMs: args.gap },
      );
    }
    if (typeof batch.parseTx === 'function') {
      await repeat(rec, 'batch.parseTx', () => batch.parseTx([fx.txid]), {
        iters: args.iters,
        gapMs: args.gap,
      });
    }
  }

  // ─── createInscriptionOutput ─────────────────────────────────────────────
  header('Misc');
  const cfg = await mnee.config();
  await repeat(
    rec,
    'createInscriptionOutput',
    () => mnee.createInscriptionOutput(TEST_ADDRESS, 1, cfg),
    { iters: args.iters },
  );

  // ─── report ──────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log(`${COLORS.bright}Performance summary${COLORS.reset}`);
  rec.printTable();

  if (args.out) {
    rec.writeJSON(args.out, {
      environment: testConfig.environment,
      iterations: args.iters,
    });
    console.log(`\n${COLORS.green}Wrote JSON report → ${args.out}${COLORS.reset}`);
  }

  console.log(`\n${COLORS.dim}Done.${COLORS.reset}`);
}

main().catch((err) => {
  console.error('\nPerf suite failed:', err);
  process.exit(1);
});
