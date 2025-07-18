console.log('>>> TEST FILE EXECUTED');
import test from 'node:test';
import assert from 'node:assert';
import { MNEEService } from '../src/mneeService.js';
import type { Environment } from '../src/mnee.types.js';
import dotenv from 'dotenv';

dotenv.config();

const ENV = process.env.MNEE_ENVIRONMENT || 'sandbox';
let LICENSE = '';
if (ENV === 'production') {
  LICENSE = process.env.MNEE_LICENSE_PROD || '';
} else {
  LICENSE = process.env.MNEE_LICENSE_SANDBOX || '';
}
if (!LICENSE) {
  throw new Error(`Missing license for environment '${ENV}'. Please set MNEE_LICENSE_${ENV.toUpperCase()} in your .env file.`);
}

import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('MNEEService Transaction Parsing', async (t) => {
  const mneeService = new MNEEService({
    environment: ENV as Environment,
    apiKey: LICENSE,
  });

  const samplesDir = path.join(__dirname, 'samples');
  const sampleFiles = await readdir(samplesDir);

  for (const fileName of sampleFiles) {
    if (path.extname(fileName) !== '.hex') continue;

    await t.test(`MNEEService parses a valid transaction from ${fileName}`, async () => {
      const filePath = path.join(samplesDir, fileName);
      const txHex = await readFile(filePath, 'utf-8');
      const result = await mneeService.parseTxFromRawTx(txHex.trim());

      assert.ok(result, 'Should return a result object');
      assert.ok(result.txid, 'Should have a txid');
      assert.ok(Array.isArray(result.inputs), 'Inputs should be an array');
      assert.ok(Array.isArray(result.outputs), 'Outputs should be an array');
    });
  }
});
