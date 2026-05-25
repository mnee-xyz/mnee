/**
 * Probe: find a parent tx with many outputs (the user reported a 22223-output source).
 * Walk a few levels of the input graph from the most recent history tx and print sizes.
 */
import Mnee from '@mnee/ts-sdk';
import { Transaction } from '@bsv/sdk';
import testConfig from './testConfig.js';

const mnee = new Mnee({ environment: testConfig.environment, apiKey: testConfig.apiKey });
const TEST_ADDRESS = testConfig.addresses.testAddress;
const API_BASE = testConfig.environment === 'production'
  ? 'https://proxy-api.mnee.net'
  : 'https://sandbox-proxy-api.mnee.net';

async function rawFetch(txid) {
  const url = `${API_BASE}/v1/tx/${txid}?auth_token=${testConfig.apiKey}`;
  const t0 = Date.now();
  const resp = await fetch(url);
  const dt = Date.now() - t0;
  const body = await resp.text();
  return { status: resp.status, dt, bodyLen: body.length, snippet: body.slice(0, 80) };
}

async function probe(txid, depth = 0) {
  const indent = '  '.repeat(depth);
  const raw = await rawFetch(txid);
  if (raw.status !== 200) {
    console.log(`${indent}${txid.slice(0,16)}… HTTP ${raw.status} (${raw.snippet})`);
    return null;
  }
  try {
    const tx = await mnee.fetchSourceTransaction(txid);
    if (!tx) {
      console.log(`${indent}${txid.slice(0,16)}… SDK undefined despite HTTP 200`);
      return null;
    }
    console.log(`${indent}${txid.slice(0,16)}… inputs=${tx.inputs.length} outputs=${tx.outputs.length} bodyLen=${raw.bodyLen}`);
    if (tx.outputs.length > 100) {
      console.log(`${indent}  ⚠ LARGE OUTPUT COUNT: ${tx.outputs.length}`);
    }
    return tx;
  } catch (e) {
    console.log(`${indent}${txid.slice(0,16)}… throw: ${e?.message}`);
    return null;
  }
}

async function main() {
  const limits = [5, 20, 50];
  for (const limit of limits) {
    console.log(`\n=== history limit=${limit} ===`);
    const history = await mnee.recentTxHistory(TEST_ADDRESS, undefined, limit);
    for (let i = 0; i < history.history.length; i++) {
      const txid = history.history[i].txid;
      console.log(`\n[${i}] history ${txid}`);
      const tx = await probe(txid, 1);
      if (!tx) continue;
      for (const inp of tx.inputs) {
        if (inp.sourceTXID) await probe(inp.sourceTXID, 2);
      }
    }
    break; // limit=5 enough; comment out to try more
  }
}

main().catch(e => { console.error('ERR:', e?.message); process.exit(1); });
