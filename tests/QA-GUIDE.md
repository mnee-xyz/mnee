# MNEE SDK QA Testing Guide

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

## Testing Timeline

**Target Completion: 1-2 weeks maximum**

This SDK is a critical dependency for the MNEE ecosystem and needs to be released as soon as possible.

## Pre-existing Test Coverage

We have already implemented comprehensive test coverage for all 18 main SDK methods. The tests are located in `/tests/` and can be run individually or as a suite.

### Test Organization

```
tests/
├── Individual Method Tests (18 files)
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
├── Supporting Files
│   ├── tests.config.json - Test configuration
│   ├── knownTestTransactions.json - Known test data
│   └── test-todos.md - Test planning document
│
└── run-all.js - Run entire test suite with cooldowns
```

## Running Existing Tests

### Prerequisites

1. Install dependencies: `npm install`
2. Build the SDK: `npm run build`
3. Configure test environment in `tests/tests.config.json`

### Running Tests

#### Run All Tests (Recommended)

```bash
# Run the complete test suite with 5-second cooldowns between tests
node tests/run-all.js
```

This will:

- Run all 18 core SDK method tests
- Run all 9 batch processing tests
- Show progress with visual countdown between tests
- Provide a comprehensive summary at the end
- Stop on first failure to prevent cascading errors

#### Run Individual Tests

```bash
# Run specific test files
node tests/balance.js
node tests/transfer.js
# ... etc
```

## Critical Areas for QA Focus

### 1. Core Token Operations (HIGHEST PRIORITY)

#### Balance Management

- **Single Address**: `balance()` - Get balance for one address
- **Multiple Addresses**: `balances()` - Get balances for multiple addresses
- **UTXO Retrieval**: `getUtxos()` - Get unspent outputs for spending
- **Test Files**: `tests/balance.js`, `tests/balances.js`, `tests/getUtxos.js`
- **Focus**: Accuracy of balance calculations and UTXO state

#### Token Transfers

- **Simple Transfer**: `transfer()` - Send tokens from single address
- **Complex Transfer**: `transferMulti()` - Send from multiple addresses with UTXO control
- **Raw Submission**: `submitRawTx()` - Submit pre-signed transactions
- **Test Files**: `tests/transfer.js`, `tests/transferMulti.js`, `tests/submitRawTx.js`
- **Critical**: Ensure transactions are valid and broadcast successfully

### 2. Transaction Analysis & Validation

- **Validation**: `validateMneeTx()` - Verify transaction correctness
- **Parsing by ID**: `parseTx()` - Parse transaction from txid
- **Parsing Raw**: `parseTxFromRawTx()` - Parse from raw hex
- **Test Files**: `tests/validateMneeTx.js`, `tests/parseTx.js`, `tests/parseTxFromRawTx.js`
- **Focus**: Accurate parsing and validation of all transaction types

### 3. HD Wallet Support

- **Wallet Creation**: `HDWallet()` - BIP32/BIP44 hierarchical wallets
- **Key Derivation**: Address generation and private key management
- **Multi-address Operations**: Integration with `transferMulti()`
- **Test File**: `tests/hdWallet.js`
- **Focus**: Standard compliance and key security

### 4. History & Data Retrieval

- **Single History**: `recentTxHistory()` - Get transactions for one address
- **Bulk History**: `recentTxHistories()` - Get transactions for multiple addresses
- **Script Parsing**: `parseInscription()`, `parseCosignerScripts()`
- **Test Files**: `tests/recentTxHistory.js`, `tests/recentTxHistories.js`
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

See `tests/batch/setup.js` for pre-configured test addresses with known balances.

### API Keys

Configure in `tests/tests.config.json`:

- Default: 3 requests/second

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
# Build SDK and run complete test suite
npm run build && node tests/run-all.js
```

This builds the SDK and runs all tests with proper cooldown periods to prevent overwhelming the API server. The test suite includes:

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
