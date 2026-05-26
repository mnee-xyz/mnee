// Performance timing helper for MNEE SDK QA tests.
//
// Usage:
//   import { Recorder, time } from './perfTimer.js';
//
//   const rec = new Recorder();
//   await time(rec, 'mnee.balance', () => mnee.balance(addr));
//   rec.printTable();
//
// Records wall-clock duration (ms) per labeled call and reports
// count / min / mean / p50 / p95 / p99 / max for each label.

import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

function fmtMs(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(2)}s`;
  if (n >= 10) return `${n.toFixed(1)}ms`;
  if (n >= 1) return `${n.toFixed(2)}ms`;
  return `${n.toFixed(3)}ms`;
}

function pad(s, n, right = false) {
  s = String(s);
  if (s.length >= n) return s;
  const fill = ' '.repeat(n - s.length);
  return right ? s + fill : fill + s;
}

export class Recorder {
  constructor() {
    /** @type {Map<string, { samples: number[]; errors: number; skipped?: string }>} */
    this.entries = new Map();
    this.order = [];
  }

  _get(label) {
    let e = this.entries.get(label);
    if (!e) {
      e = { samples: [], errors: 0 };
      this.entries.set(label, e);
      this.order.push(label);
    }
    return e;
  }

  add(label, ms) {
    this._get(label).samples.push(ms);
  }

  recordError(label) {
    this._get(label).errors += 1;
  }

  skip(label, reason) {
    this._get(label).skipped = reason;
  }

  stats(label) {
    const e = this.entries.get(label);
    if (!e || e.samples.length === 0) {
      return { count: 0, errors: e?.errors ?? 0, skipped: e?.skipped };
    }
    const sorted = [...e.samples].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    return {
      count: sorted.length,
      errors: e.errors,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: sum / sorted.length,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
    };
  }

  allStats() {
    const out = {};
    for (const label of this.order) out[label] = this.stats(label);
    return out;
  }

  printTable() {
    const cols = ['method', 'n', 'err', 'min', 'mean', 'p50', 'p95', 'p99', 'max'];
    const widths = { method: 36, n: 5, err: 4, min: 10, mean: 10, p50: 10, p95: 10, p99: 10, max: 10 };

    const header = cols
      .map((c) => (c === 'method' ? pad(c, widths[c], true) : pad(c, widths[c])))
      .join(' ');
    console.log(`\n${COLORS.bright}${header}${COLORS.reset}`);
    console.log('─'.repeat(header.length));

    for (const label of this.order) {
      const s = this.stats(label);

      if (s.skipped) {
        console.log(
          `${pad(label, widths.method, true)} ${COLORS.dim}skipped — ${s.skipped}${COLORS.reset}`,
        );
        continue;
      }

      if (s.count === 0) {
        const err = s.errors > 0 ? `${COLORS.red}${s.errors}${COLORS.reset}` : '0';
        console.log(
          `${pad(label, widths.method, true)} ${pad('0', widths.n)} ${pad(err, widths.err + (s.errors > 0 ? 9 : 0))} ${COLORS.dim}(no samples)${COLORS.reset}`,
        );
        continue;
      }

      const errStr = s.errors > 0 ? `${COLORS.red}${s.errors}${COLORS.reset}` : '0';
      const errPad = widths.err + (s.errors > 0 ? 9 : 0);

      console.log(
        [
          pad(label, widths.method, true),
          pad(s.count, widths.n),
          pad(errStr, errPad),
          pad(fmtMs(s.min), widths.min),
          pad(fmtMs(s.mean), widths.mean),
          pad(fmtMs(s.p50), widths.p50),
          pad(fmtMs(s.p95), widths.p95),
          pad(fmtMs(s.p99), widths.p99),
          pad(fmtMs(s.max), widths.max),
        ].join(' '),
      );
    }
  }

  toJSON({ environment, iterations, timestamp } = {}) {
    return {
      timestamp: timestamp ?? new Date().toISOString(),
      environment,
      iterations,
      results: this.allStats(),
    };
  }

  writeJSON(filePath, meta) {
    writeFileSync(filePath, JSON.stringify(this.toJSON(meta), null, 2), 'utf8');
  }
}

// Time a single async or sync call. Errors increment err counter but
// don't abort the run — failing methods still appear in the table.
export async function time(recorder, label, fn) {
  const t0 = performance.now();
  try {
    const result = await fn();
    recorder.add(label, performance.now() - t0);
    return result;
  } catch (err) {
    recorder.recordError(label);
    throw err;
  }
}

// Run `fn` `iters` times, swallowing per-iter errors so a flaky method
// still produces stats for its successful calls. `gapMs` lets you space
// network calls out under a rate limit.
export async function repeat(recorder, label, fn, { iters = 10, gapMs = 0, warmup = 0 } = {}) {
  for (let i = 0; i < warmup; i++) {
    try {
      await fn(i);
    } catch {
      /* warmup errors don't count */
    }
  }
  for (let i = 0; i < iters; i++) {
    try {
      await time(recorder, label, () => fn(i));
    } catch (err) {
      // already counted; print compact diagnostic
      console.log(`  ${COLORS.red}× ${label} iter ${i + 1}: ${err.message}${COLORS.reset}`);
    }
    if (gapMs > 0 && i < iters - 1) {
      await new Promise((r) => setTimeout(r, gapMs));
    }
  }
}
