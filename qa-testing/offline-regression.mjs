/**
 * Offline regression tests — validates optimizations without any network calls.
 * Run with: node qa-testing/offline-regression.mjs
 */

import assert from 'assert';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. filterValidUtxos — extracted constant + Set
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[1] filterValidUtxos (UTXO filter deduplication)');

const VALID_UTXO_OPS = new Set(['transfer', 'deploy+mint']);
const filterValidUtxos = (data) =>
  data.filter((u) => VALID_UTXO_OPS.has(u.data.bsv21.op.toLowerCase()));

const utxoFixture = [
  { data: { bsv21: { op: 'transfer' } } },
  { data: { bsv21: { op: 'TRANSFER' } } },     // upper-case variant
  { data: { bsv21: { op: 'deploy+mint' } } },
  { data: { bsv21: { op: 'burn' } } },          // should be excluded
  { data: { bsv21: { op: 'unknown' } } },       // should be excluded
];

test('keeps transfer utxos', () => {
  const result = filterValidUtxos(utxoFixture);
  assert.strictEqual(result.filter(u => u.data.bsv21.op.toLowerCase() === 'transfer').length, 2);
});

test('keeps deploy+mint utxos', () => {
  const result = filterValidUtxos(utxoFixture);
  assert(result.some(u => u.data.bsv21.op === 'deploy+mint'));
});

test('excludes burn utxos', () => {
  const result = filterValidUtxos(utxoFixture);
  assert(!result.some(u => u.data.bsv21.op === 'burn'));
});

test('excludes unknown utxos', () => {
  const result = filterValidUtxos(utxoFixture);
  assert(!result.some(u => u.data.bsv21.op === 'unknown'));
});

test('returns exactly 3 valid utxos', () => {
  assert.strictEqual(filterValidUtxos(utxoFixture).length, 3);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. lookupFee — extracted fee helper
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[2] lookupFee (fee tier extraction)');

const lookupFee = (atomicAmount, fees) =>
  fees.find((f) => atomicAmount >= f.min && atomicAmount <= f.max)?.fee;

const feeFixture = [
  { min: 0,      max: 100000,   fee: 1000  },
  { min: 100001, max: 1000000,  fee: 5000  },
  { min: 1000001, max: 999999999, fee: 10000 },
];

test('finds fee in first tier', () =>
  assert.strictEqual(lookupFee(50000, feeFixture), 1000));

test('finds fee at tier boundary (min)', () =>
  assert.strictEqual(lookupFee(0, feeFixture), 1000));

test('finds fee at tier boundary (max)', () =>
  assert.strictEqual(lookupFee(100000, feeFixture), 1000));

test('finds fee in second tier', () =>
  assert.strictEqual(lookupFee(500000, feeFixture), 5000));

test('returns undefined when outside all tiers', () =>
  assert.strictEqual(lookupFee(1_000_000_000, feeFixture), undefined));

test('returns undefined for empty tiers', () =>
  assert.strictEqual(lookupFee(100, []), undefined));

// ─────────────────────────────────────────────────────────────────────────────
// 3. batch.ts — Set for address inclusion (O(1) correctness)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[3] Batch address Set lookup');

function mapUtxosByAddress(validAddresses, allUtxos, chunk) {
  const validAddressSet = new Set(validAddresses);
  return chunk.map((address) => ({
    address,
    utxos: validAddressSet.has(address)
      ? allUtxos.filter((u) => u.owners.includes(address))
      : [],
  }));
}

const utxos = [
  { owners: ['addr1', 'addr2'] },
  { owners: ['addr1'] },
  { owners: ['addr3'] },
];

test('valid address gets its UTXOs', () => {
  const result = mapUtxosByAddress(['addr1'], utxos, ['addr1']);
  assert.strictEqual(result[0].utxos.length, 2);
});

test('invalid address gets empty UTXOs', () => {
  const result = mapUtxosByAddress(['addr1'], utxos, ['addr1', 'badAddr']);
  const bad = result.find(r => r.address === 'badAddr');
  assert.strictEqual(bad.utxos.length, 0);
});

test('multiple valid addresses work correctly', () => {
  const result = mapUtxosByAddress(['addr1', 'addr3'], utxos, ['addr1', 'addr2', 'addr3']);
  const r1 = result.find(r => r.address === 'addr1');
  const r2 = result.find(r => r.address === 'addr2');
  const r3 = result.find(r => r.address === 'addr3');
  assert.strictEqual(r1.utxos.length, 2);
  assert.strictEqual(r2.utxos.length, 0);  // addr2 not in validAddresses
  assert.strictEqual(r3.utxos.length, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. HDWallet LRU cache — eviction behaviour
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[4] HDWallet LRU cache (eviction)');

function makeCache(cacheSize) {
  const cache = new Map();

  function store(key, value) {
    if (cache.size >= cacheSize) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) cache.delete(oldestKey);
    }
    cache.set(key, value);
  }

  return { cache, store };
}

test('cache does not exceed cacheSize', () => {
  const { cache, store } = makeCache(3);
  store('a', 1); store('b', 2); store('c', 3); store('d', 4);
  assert.strictEqual(cache.size, 3);
});

test('oldest entry is evicted first (LRU order)', () => {
  const { cache, store } = makeCache(3);
  store('a', 1); store('b', 2); store('c', 3); store('d', 4);
  assert(!cache.has('a'), 'oldest key "a" should have been evicted');
  assert(cache.has('d'), 'newest key "d" should be present');
});

test('cache still works after eviction', () => {
  const { cache, store } = makeCache(2);
  store('x', 10); store('y', 20); store('z', 30);
  assert.strictEqual(cache.get('y'), 20);
  assert.strictEqual(cache.get('z'), 30);
});

test('original behaviour: cache of size 1 keeps only latest', () => {
  const { cache, store } = makeCache(1);
  store('a', 1); store('b', 2);
  assert(!cache.has('a'));
  assert(cache.has('b'));
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Config promise deduplication (getConfig race-condition fix)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[5] Config promise deduplication (race-condition fix)');

function makeConfigCache() {
  let mneeConfig = undefined;
  let mneeConfigPromise = null;
  let fetchCallCount = 0;

  async function getCosignerConfig() {
    fetchCallCount++;
    await new Promise(r => setTimeout(r, 10)); // simulate async
    mneeConfig = { tokenId: 'test' };
    return mneeConfig;
  }

  async function getConfig() {
    if (mneeConfig) return mneeConfig;
    if (!mneeConfigPromise) {
      mneeConfigPromise = getCosignerConfig().catch((err) => {
        mneeConfigPromise = null;
        throw err;
      });
    }
    return mneeConfigPromise;
  }

  return { getConfig, getFetchCount: () => fetchCallCount };
}

await asyncTest('concurrent callers share one in-flight request', async () => {
  const { getConfig, getFetchCount } = makeConfigCache();
  await Promise.all([getConfig(), getConfig(), getConfig(), getConfig()]);
  assert.strictEqual(getFetchCount(), 1, `expected 1 fetch, got ${getFetchCount()}`);
});

await asyncTest('second call after first resolves uses cached config', async () => {
  const { getConfig, getFetchCount } = makeConfigCache();
  await getConfig();
  await getConfig();
  assert.strictEqual(getFetchCount(), 1);
});

await asyncTest('failed promise is cleared so next call retries', async () => {
  let mneeConfigPromise = null;
  let calls = 0;
  async function failOnce() {
    calls++;
    if (calls === 1) throw new Error('network down');
    return { tokenId: 'ok' };
  }
  async function getConfig() {
    if (!mneeConfigPromise) {
      mneeConfigPromise = failOnce().catch((err) => {
        mneeConfigPromise = null;
        throw err;
      });
    }
    return mneeConfigPromise;
  }

  try { await getConfig(); } catch (_) {}   // first call fails
  const result = await getConfig();          // second call should succeed
  assert.strictEqual(result.tokenId, 'ok');
  assert.strictEqual(calls, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
