# MNEE SDK QA Testing Guide

## Quick Start for QA Team

> This repository contains **two** `package.json` files:
> - **`./package.json`** — the SDK itself (`@mnee/ts-sdk`). This is what gets published.
> - **`./qa-testing/package.json`** — a standalone consumer project that installs the built SDK from a local `.tgz` and runs the test suite.
>
> **Always run testing from the repository root.** Do not `cd qa-testing` first; the root `npm test` script handles building the SDK, packaging it, installing it into `qa-testing/`, and running the suite.

```bash
# Clone and setup
git clone [repo-url]
cd mnee
git checkout qa-testing

# One-time install of SDK dev dependencies
npm install

# Build the SDK and run the full QA test suite
npm run build
npm test
```

That's it. `npm test` (defined in the root `package.json`) does:

```
cd qa-testing && npm run prepare-package && node run-all.js
```

`prepare-package` copies the freshly built `mnee-ts-sdk-*.tgz` into `qa-testing/versions/`, reinstalls it, and then `run-all.js` executes every test.

## Project Overview

The MNEE SDK is a JavaScript/TypeScript SDK for interacting with MNEE tokens on the BSV blockchain. It provides comprehensive functionality for:

**Core Features:**

- Token transfers (single and multi-source)
- Balance queries and UTXO management
- Transaction parsing and validation
- HD wallet support (BIP32/BIP44)
- Transaction history retrieval
- Inscription and cosigner script parsing

**Helper Features:**

- Batch operations for processing multiple addresses
- Automatic rate limiting for API calls

## TypeScript Support

- **Minimum TypeScript Version**: 4.5+ (for TypeScript users)
- **JavaScript Support**: Full support - TypeScript is not required
- **Type Definitions**: Included automatically via `dist/index.d.ts`
- **Strict Mode**: The SDK is built with TypeScript strict mode enabled
- **Build Version**: SDK is built with TypeScript 5.4.5 but maintains compatibility with 4.5+

## Testing Timeline

**Target Completion: 1-2 weeks maximum**

This SDK is a critical dependency for the MNEE ecosystem and needs to be released as soon as possible.

## Pre-existing Test Coverage

We have already implemented comprehensive test coverage for all 18 main SDK methods. The tests have been organized into a standalone test project that consumes the mnee package as a real dependency.

### Test Organization

```
qa-testing/
├── package.json - Standalone test project with mnee as dependency
├── node_modules/ - Contains installed mnee package from versions/qa-mnee-0.0.1.tgz
├── testConfig.js - Test configuration
│
├── core/ - Core SDK method tests (18 files)
│   ├── config.js - Configuration management
│   ├── balance.js - Single address balance queries
│   ├── balances.js - Multiple address balance queries
│   ├── getUtxos.js - UTXO retrieval
│   ├── validateMneeTx.js - Transaction validation
│   ├── transfer.js - Single recipient transfers
│   ├── transferMulti.js - Multiple recipient transfers
│   ├── submitRawTx.js - Raw transaction submission
│   ├── toAtomicAmount.js - Decimal to atomic conversion
│   ├── fromAtomicAmount.js - Atomic to decimal conversion
│   ├── recentTxHistory.js - Single address history
│   ├── recentTxHistories.js - Multiple address histories
│   ├── parseTx.js - Transaction parsing by txid
│   ├── parseTxFromRawTx.js - Transaction parsing from raw hex
│   ├── parseInscription.js - Inscription detection
│   ├── parseCosignerScripts.js - Cosigner script parsing
│   ├── hdWallet.js - HD wallet functionality
│   └── batch.js - Batch operations (comprehensive)
│
├── batch/ - Modular batch tests
│   ├── setup.js - Shared test setup
│   ├── 01-instance-creation.js
│   ├── 02-get-balances.js
│   ├── 03-get-utxos.js
│   ├── 04-get-tx-histories.js
│   ├── 05-parse-tx.js
│   ├── 06-error-handling.js
│   ├── 07-rate-limiting.js
│   ├── 08-hd-wallet-integration.js
│   └── 09-edge-cases.js
│
├── versions/ - Package versions for testing
│   ├── .qa-version - Current QA version number
│   └── qa-mnee-*.tgz - Built packages (gitignored, build locally)
│
├── Supporting Files
│   ├── knownTestTransactions.json - Known test data
│
└── run-all.js - Run entire test suite with cooldowns
```

### Important: Test Isolation

The test suite is now completely isolated from the main project:
- Tests import mnee as `import Mnee from 'mnee'` (not from dist/)
- The mnee package is installed from the local .tgz file
- Tests run in their own npm project with proper dependencies

## Running Existing Tests

### Prerequisites

All commands below are run **from the repository root** (the directory containing the SDK `package.json`), unless explicitly stated otherwise. Test configuration is already set up in `qa-testing/testConfig.js`.

### Building and Packaging

The root `npm run build` builds the SDK and produces a `mnee-ts-sdk-<version>.tgz` in the root directory. The `qa-testing` project then installs that tarball via its `prepare-package` script.

```bash
# From repository root

# Build SDK and emit mnee-ts-sdk-*.tgz
npm run build

# Run full test suite (handles tgz copy + install + run)
npm test
```

**Workflow for testing SDK changes:**
1. Edit SDK source in `src/`.
2. From the root: `npm run build` to rebuild and repackage.
3. From the root: `npm test` to install the new tarball into `qa-testing/` and run every test.

### Running Tests

#### Run All Tests (Recommended)

```bash
# From repository root
npm test
```

This will:

- Run all 18 core SDK method tests
- Run all 9 batch processing tests
- Show progress with visual countdown between tests
- Provide a comprehensive summary at the end
- Stop on first failure to prevent cascading errors

#### Run Individual Tests

Individual test files must be invoked from inside `qa-testing/` because they import the SDK from that project's `node_modules/`. **Run `npm test` from the root at least once first** so the SDK tarball is built and installed.

```bash
# From qa-testing/
node core/balance.js
node core/transfer.js
# ... etc
```

## Critical Areas for QA Focus

### 1. Core Token Operations (HIGHEST PRIORITY)

#### Balance Management

- **Single Address**: `balance()` - Get balance for one address
- **Multiple Addresses**: `balances()` - Get balances for multiple addresses
- **UTXO Retrieval**: `getUtxos()` - Get unspent outputs for spending
- **Test Files**: `core/balance.js`, `core/balances.js`, `core/getUtxos.js`
- **Focus**: Accuracy of balance calculations and UTXO state

#### Token Transfers

- **Simple Transfer**: `transfer()` - Send tokens from single address
- **Complex Transfer**: `transferMulti()` - Send from multiple addresses with UTXO control
- **Raw Submission**: `submitRawTx()` - Submit pre-signed transactions
- **Test Files**: `core/transfer.js`, `core/transferMulti.js`, `core/submitRawTx.js`
- **Critical**: Ensure transactions are valid and broadcast successfully

### 2. Transaction Analysis & Validation

- **Validation**: `validateMneeTx()` - Verify transaction correctness
- **Parsing by ID**: `parseTx()` - Parse transaction from txid
- **Parsing Raw**: `parseTxFromRawTx()` - Parse from raw hex
- **Test Files**: `core/validateMneeTx.js`, `core/parseTx.js`, `core/parseTxFromRawTx.js`
- **Focus**: Accurate parsing and validation of all transaction types

### 3. HD Wallet Support

- **Wallet Creation**: `HDWallet()` - BIP32/BIP44 hierarchical wallets
- **Key Derivation**: Address generation and private key management
- **Multi-address Operations**: Integration with `transferMulti()`
- **Test File**: `core/hdWallet.js`
- **Focus**: Standard compliance and key security

### 4. History & Data Retrieval

- **Single History**: `recentTxHistory()` - Get transactions for one address
- **Bulk History**: `recentTxHistories()` - Get transactions for multiple addresses
- **Script Parsing**: `parseInscription()`, `parseCosignerScripts()`
- **Test Files**: `core/recentTxHistory.js`, `core/recentTxHistories.js`
- **Verification**: Compare with blockchain explorer data

### 5. Helper Utilities

- **Amount Conversion**: `toAtomicAmount()`, `fromAtomicAmount()`
- **Configuration**: `config()` - Get fee tiers and settings
- **Batch Operations**: `batch()` - Process large address sets efficiently
- **Test Files**: See individual method tests
- **Note**: These are utility functions to support the core operations

## Additional QA Testing Recommendations

### 1. Core Method Testing

- **Transfer Scenarios**:
  - Minimum amount transfers (dust limits)
  - Maximum amount transfers (entire balance minus fees)
  - Multi-recipient transfers
  - Failed transfers (insufficient balance)
- **Balance Accuracy**:

  - Zero balance addresses
  - Addresses with pending transactions
  - Recently funded addresses
  - Cross-reference with block explorer

- **Transaction Validation**:
  - Valid MNEE transactions
  - Invalid/malformed transactions
  - Non-MNEE transactions
  - Double-spend attempts

### 2. Integration Testing

- **Basic Wallet Implementation**:
  - Create a simple wallet using core SDK methods
  - Send and receive MNEE tokens
  - Display balance and transaction history
- **HD Wallet Recovery**:
  - Generate mnemonic and derive addresses
  - Recover wallet from mnemonic
  - Sweep funds to new address
- **TypeScript Integration**:
  - Verify all types are properly exported
  - Test strict mode compliance
  - Ensure IDE autocomplete works correctly

### 3. Security Testing

- **Private Key Handling**:
  - Verify keys are never logged in any SDK method
  - Test that WIF keys are validated before use
  - Ensure keys are cleared from memory after use
- **Transaction Security**:
  - Verify signatures are properly generated
  - Test that invalid signatures are rejected
  - Ensure change addresses are correctly calculated
- **API Security**:
  - Test API key authentication
  - Verify HTTPS is enforced
  - Check error messages don't leak sensitive data

### 4. Edge Case Testing

**Core Method Edge Cases**:

- **Transfer Edge Cases**:
  - Attempting to send 0 MNEE
  - Sending exact balance (fee calculation)
  - Multiple outputs to same address
  - Invalid recipient addresses
- **Balance Edge Cases**:
  - Newly created addresses (never used)
  - Addresses with only dust amounts
  - Addresses with maximum token supply
- **UTXO Edge Cases**:
  - Addresses with hundreds of UTXOs
  - Recently spent UTXOs
  - Unconfirmed UTXOs
- **Error Scenarios**:
  - Network timeouts during transfer
  - Invalid API responses
  - Blockchain reorganizations

### 5. Performance Testing

**Core Operations Performance**:

- **Single Operations**:
  - `balance()`
  - `transfer()`
  - `parseTx()`
- **Bulk Operations**:
  - `balances()` with 20 addresses
  - `recentTxHistories()` with 10 addresses
  - HD wallet derivation of 100 addresses
- **Large Scale (using batch helper)**:
  - 1000+ addresses: Use batch methods
  - Monitor memory usage
  - Verify rate limiting works correctly

#### Performance Suite

A standalone perf-suite measures latency for every public SDK method. Run `npm test` from the root once first so the SDK is built and installed; perf scripts run from inside `qa-testing/`.

```bash
# From qa-testing/
npm run test:perf

# Custom iteration count
node perf/perf-suite.mjs --iters 20

# Include mutating ops (consumes sandbox funds)
node perf/perf-suite.mjs --include-mutating

# Write JSON report
node perf/perf-suite.mjs --out perf/report.json
```

The suite:

- Runs each SDK method N times (default 10) and prints a table of
  `count / min / mean / p50 / p95 / p99 / max` per method.
- Defaults to a 350 ms gap between network calls to respect the 3 req/s
  rate limit (override with `--gap MS`).
- Skips mutating methods (`transfer`, `transferMulti`, `submitRawTx`,
  `refreshConfig`) by default — opt in with `--include-mutating`.
- Builds fixtures (recent txid, raw tx hex, BEEF hex, inscription /
  cosigner scripts) once from the test address history.

The helper module `perf/perfTimer.js` exports `Recorder`, `time()`, and
`repeat()` so any existing test file can opt in to per-call timings.

## Method-Specific Testing Guidelines

### Essential Methods Priority

1. **`transfer(recipients, wif)`**

   - Most critical method - handles user funds
   - Test with various amounts and recipient counts
   - Verify fee calculation matches config
   - Ensure change is returned correctly

2. **`balance(address)` / `balances(addresses)`**

   - Foundation for wallet functionality
   - Must be 100% accurate
   - Test with all address states

3. **`validateMneeTx(txHex)`**

   - Critical for transaction security
   - Test with valid and invalid transactions
   - Verify all validation rules

4. **`getUtxos(addresses)`**
   - Required for transaction building
   - Test with various UTXO counts
   - Verify spent detection works

### Helper Methods (Lower Priority)

- **`batch()`**: For processing large address sets
- **Conversion methods**: Simple mathematical operations

## Test Data & Environment

### Environments

- **Production**: Production testing (use with caution)
- **Sandbox**: Primary testing environment

### Test Addresses

See `batch/setup.js` for pre-configured test addresses with known balances.

### API Keys

API key is configured in `testConfig.js`:

- The `apiKey` field is automatically passed to all Mnee instances in tests
- Default rate limit: 3 requests/second
- All test files use the same API key for consistency

## Regression Testing Checklist

For each SDK release, verify:

**Core Functionality**:

- [ ] Token transfers work correctly (single and multi-source)
- [ ] Balance queries are accurate
- [ ] Transaction validation catches invalid transactions
- [ ] UTXO retrieval matches blockchain state
- [ ] HD wallet derivation follows BIP32/BIP44
- [ ] Fee calculations match configuration

**Test Suite**:

- [ ] All 18 core method tests pass
- [ ] Batch helper tests pass (when applicable)
- [ ] No breaking changes to public API
- [ ] TypeScript definitions are accurate
- [ ] Package builds successfully
- [ ] Documentation reflects current implementation

## Reporting Issues

When reporting issues, please include:

1. Test file and specific test case
2. Error message and stack trace
3. Environment being used (sandbox/production)
4. SDK version
5. Node.js version
6. Steps to reproduce

## Quick Validation Script

For rapid validation, QA can run:

```bash
# From repository root
npm install      # Install SDK dev dependencies (one-time)
npm run build    # Build SDK and emit mnee-ts-sdk-*.tgz
npm test         # Package, install into qa-testing/, run full suite
```

This runs all tests with proper cooldown periods to prevent overwhelming the API server. The test suite includes:

- Configuration and setup validation
- All core token operations
- Transaction parsing and validation
- HD wallet functionality
- Batch processing capabilities
- Error handling scenarios

The 5-second cooldown between tests ensures:

- API rate limits are respected
- Server resources aren't overwhelmed
- Each test starts with a clean state
- Clear visual progress tracking

**Note**: The `batch.js` test file includes all 9 batch operation subtests internally, so individual batch test files in the `batch/` directory don't need to be run separately.

---

**Note**: The existing test suite covers all major functionality and many edge cases. QA efforts should focus on validating the test suite accuracy, performance characteristics, and integration scenarios rather than basic functionality testing.
