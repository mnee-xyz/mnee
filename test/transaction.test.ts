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
  const sampleFiles = (await readdir(samplesDir)).filter((file) => path.extname(file) === '.hex');

  const testCases = sampleFiles.map((fileName) => ({
    fileName,
    shouldPass: fileName !== 'bsv-20-noinput.hex',
  }));

  for (const { fileName, shouldPass } of testCases) {
    const testTitle = shouldPass
      ? `parses a valid transaction from ${fileName}`
      : `correctly fails to parse invalid transaction from ${fileName}`;

    await t.test(testTitle, async () => {
      const filePath = path.join(samplesDir, fileName);
      const txHex = await readFile(filePath, 'utf-8');

      if (shouldPass) {
        const result = await mneeService.parseTxFromRawTx(txHex.trim());

        assert.ok(result, 'Should return a result object');
        assert.strictEqual(typeof result.txid, 'string', 'Should have a string txid');
        assert.ok(Array.isArray(result.inputs), 'Inputs should be an array');
        assert.ok(Array.isArray(result.outputs), 'Outputs should be an array');

        result.inputs.forEach((input) => {
          assert.strictEqual(typeof input.address, 'string', 'Input address should be a string');
          assert.strictEqual(typeof input.amount, 'number', 'Input amount should be a number');
        });

        result.outputs.forEach((output, i) => {
          assert.ok(output, `Output ${i} should be an object`);
          assert.strictEqual(typeof output.address, 'string', `Output ${i} should have a string address`);
          assert.strictEqual(typeof output.amount, 'number', `Output ${i} should have a number amount`);
          assert.ok(typeof output.script === 'string' && output.script.length > 0, `Output ${i} should have a non-empty script`);
        });

        // For non-deploy transactions, inputs and outputs should balance
        if (result.type !== 'deploy') {
          const totalInputs = result.inputs.reduce((sum, input) => sum + input.amount, 0);
          const totalOutputs = result.outputs.reduce((sum, output) => sum + output.amount, 0);
          assert.strictEqual(totalInputs, totalOutputs, 'Total inputs should equal total outputs');
        }
      } else {
        await assert.rejects(
          mneeService.parseTxFromRawTx(txHex.trim()),
          (err) => {
            assert.ok(err instanceof Error, 'Should throw an error');
            return true;
          },
          'Should reject with an error for invalid hex'
        );
      }
    });
  }
});
