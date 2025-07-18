# MNEE SDK QA Testing Guide

## Quick Start for QA Team

```bash
# Clone and setup
git clone [repo-url]
cd mnee
git checkout qa-testing
cd qa-testing

# Build and install
npm run build
npm install

# Run all tests
node run-all.js
```

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

1. Navigate to the test directory: `cd qa-testing`
2. Build the mnee package locally: `npm run build`
3. Install dependencies: `npm install`
4. Test configuration is already set up in `testConfig.js`

### Building and Version Management

The test suite uses its own versioning system independent of the main package:

```bash
# From the qa-testing directory

# Build the current SDK and create a QA version
npm run build

# Bump the QA version (e.g., 0.0.1 → 0.0.2)
npm run bump

# Install the latest QA version
npm run install:latest
```

**Version Management:**
- QA versions start at 0.0.1 and increment independently from the SDK version
- Version number is stored in `versions/.qa-version`
- Built packages are stored as `versions/qa-mnee-X.X.X.tgz`
- All `.tgz` files are gitignored - each developer builds locally

**Workflow for Testing Changes:**
1. Make changes to the SDK in the parent directory
2. In qa-testing, run `npm run bump` to increment version
3. Run `npm run build` to build and package the SDK
4. Run `npm run install:latest` to install the new version
5. Run tests to verify changes

### Running Tests

#### Run All Tests (Recommended)

```bash
# From the qa-testing directory
node run-all.js
```

This will:

- Run all 18 core SDK method tests
- Run all 9 batch processing tests
- Show progress with visual countdown between tests
- Provide a comprehensive summary at the end
- Stop on first failure to prevent cascading errors

#### Run Individual Tests

```bash
# From the qa-testing directory
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
# From the qa-testing directory
npm install  # Install mnee package if not already done
node run-all.js  # Run complete test suite
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
