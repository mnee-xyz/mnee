// Run all MNEE SDK tests with cooldown between each test
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// All test files in order of priority
const tests = [
  // Core configuration
  { file: 'config.js', description: 'Configuration management' },
  
  // Balance operations
  { file: 'balance.js', description: 'Single address balance queries' },
  { file: 'balances.js', description: 'Multiple address balance queries' },
  
  // UTXO management
  { file: 'getUtxos.js', description: 'UTXO retrieval' },
  
  // Transaction operations
  { file: 'validateMneeTx.js', description: 'Transaction validation' },
  { file: 'transfer.js', description: 'Single-source transfers' },
  { file: 'transferMulti.js', description: 'Multi-source transfers' },
  { file: 'submitRawTx.js', description: 'Raw transaction submission' },
  
  // Utility functions
  { file: 'toAtomicAmount.js', description: 'Decimal to atomic conversion' },
  { file: 'fromAtomicAmount.js', description: 'Atomic to decimal conversion' },
  
  // History operations
  { file: 'recentTxHistory.js', description: 'Single address history' },
  { file: 'recentTxHistories.js', description: 'Multiple address histories' },
  
  // Parsing operations
  { file: 'parseTx.js', description: 'Transaction parsing by txid' },
  { file: 'parseTxFromRawTx.js', description: 'Transaction parsing from raw hex' },
  { file: 'parseInscription.js', description: 'Inscription detection' },
  { file: 'parseCosignerScripts.js', description: 'Cosigner script parsing' },
  
  // Advanced features
  { file: 'hdWallet.js', description: 'HD wallet functionality' },
  { file: 'batch.js', description: 'Batch operations (includes 9 subtests)' }
];

// Note: batch.js already runs all 9 batch subtests internally,
// so we don't need to run individual batch test files

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function showCooldown(seconds) {
  for (let i = seconds; i > 0; i--) {
    process.stdout.write(`\r${colors.cyan}⏱️  Cooldown: ${i} seconds remaining...${colors.reset}`);
    await sleep(1000);
  }
  process.stdout.write('\r' + ' '.repeat(50) + '\r'); // Clear the line
}

async function runTest(testPath, testName, index, total) {
  const startTime = Date.now();
  
  console.log(`\n${colors.bright}[${index}/${total}] Running: ${testName}${colors.reset}`);
  console.log(`${colors.dim}File: ${testPath}${colors.reset}`);
  
  try {
    execSync(`node ${join(__dirname, testPath)}`, { stdio: 'inherit' });
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n${colors.green}✅ ${testName} passed${colors.reset} ${colors.dim}(${formatTime(duration)})${colors.reset}`);
    return { success: true, duration };
  } catch (error) {
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.error(`\n${colors.red}❌ ${testName} failed${colors.reset} ${colors.dim}(${formatTime(duration)})${colors.reset}`);
    return { success: false, duration };
  }
}

async function runAllTests() {
  console.log(`${colors.bright}${colors.blue}🧪 MNEE SDK Test Suite${colors.reset}`);
  console.log(`${colors.dim}Running ${tests.length} SDK method tests${colors.reset}`);
  console.log(`${colors.dim}Each test will have a 5-second cooldown period${colors.reset}`);
  console.log('─'.repeat(60));

  const results = [];
  const startTime = Date.now();
  let currentIndex = 1;
  const totalTests = tests.length;

  // Run all tests
  console.log(`\n${colors.bright}${colors.cyan}📋 SDK Method Tests${colors.reset}`);
  for (const test of tests) {
    const result = await runTest(test.file, test.description, currentIndex, totalTests);
    results.push({ ...test, ...result });
    
    if (!result.success) {
      console.log(`\n${colors.red}Stopping test suite due to failure${colors.reset}`);
      break;
    }
    
    // Show cooldown if not the last test
    if (currentIndex < totalTests) {
      await showCooldown(5);
    }
    currentIndex++;
  }

  // Summary
  const totalDuration = Math.round((Date.now() - startTime) / 1000);
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log('\n' + '═'.repeat(60));
  console.log(`${colors.bright}📊 Test Summary${colors.reset}`);
  console.log('─'.repeat(60));
  
  if (failed === 0) {
    console.log(`${colors.green}${colors.bright}✅ All ${passed} tests passed!${colors.reset}`);
  } else {
    console.log(`${colors.green}✅ Passed: ${passed}${colors.reset}`);
    console.log(`${colors.red}❌ Failed: ${failed}${colors.reset}`);
    
    console.log(`\n${colors.red}Failed tests:${colors.reset}`);
    results.filter(r => !r.success).forEach(test => {
      console.log(`  ${colors.red}•${colors.reset} ${test.description} (${test.file})`);
    });
  }
  
  console.log(`\n${colors.dim}Total time: ${formatTime(totalDuration)}${colors.reset}`);
  console.log(`${colors.dim}Average time per test: ${formatTime(Math.round(totalDuration / results.length))}${colors.reset}`);
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Handle interruption
process.on('SIGINT', () => {
  console.log(`\n\n${colors.yellow}Test suite interrupted by user${colors.reset}`);
  process.exit(1);
});

// Run the test suite
runAllTests().catch(error => {
  console.error(`\n${colors.red}Unexpected error:${colors.reset}`, error);
  process.exit(1);
});