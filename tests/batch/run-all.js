// Run all batch tests
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const tests = [
  '01-instance-creation.js',
  '02-get-balances.js',
  '03-get-utxos.js',
  '04-get-tx-histories.js',
  '05-parse-tx.js',
  '06-error-handling.js',
  '07-rate-limiting.js',
  '08-hd-wallet-integration.js',
  '09-edge-cases.js'
];

console.log('Running all batch tests...\n');
console.log('Note: Batch provides efficient bulk operations with rate limiting.\n');

let allPassed = true;

for (const test of tests) {
  try {
    console.log(`Running ${test}...`);
    execSync(`node ${join(__dirname, test)}`, { stdio: 'inherit' });
  } catch (error) {
    console.error(`\n❌ ${test} failed!\n`);
    allPassed = false;
    break;
  }
}

if (allPassed) {
  console.log('\n✅ All batch tests passed!');
} else {
  console.log('\n❌ Some tests failed!');
  process.exit(1);
}