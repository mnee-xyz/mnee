# MNEE SDK QA Testing Guide

## Project Overview

The MNEE SDK is a JavaScript/TypeScript SDK for interacting with MNEE tokens on the BSV blockchain. It provides functionality for:

- Token transfers and balance queries
- Transaction parsing and validation
- HD wallet support
- Batch operations with rate limiting
- Cosigner script parsing
- Inscription detection

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
│   ├── 09-edge-cases.js
│   └── run-all.js - Run all batch tests
│
└── Supporting Files
    ├── tests.config.json - Test configuration
    ├── knownTestTransactions.json - Known test data
    └── test-todos.md - Test planning document
```

## Running Existing Tests

### Prerequisites

1. Install dependencies: `npm install`
2. Build the SDK: `npm run build`
3. Configure test environment in `tests/tests.config.json`

### Run All Tests

```bash
# Run individual test files
node tests/balance.js
node tests/transfer.js
# ... etc

# Run all batch tests
node tests/batch/run-all.js
```

## Critical Areas for QA Focus

### 1. API Rate Limiting (HIGH PRIORITY)

- **Current Implementation**: Default 3 req/s, configurable based on api key limit
- **Test**: Verify rate limiting doesn't overwhelm the API server
- **Focus**: Batch operations with high concurrency
- **Test File**: `tests/batch/07-rate-limiting.js`

### 2. Error Handling & Recovery

- **Test**: Network failures, invalid inputs, API errors
- **Focus**: Ensure SDK gracefully handles all error scenarios
- **Test Files**:
  - `tests/batch/06-error-handling.js`
  - Individual method tests include error cases

### 3. Transaction Building & Validation

- **Critical**: Transfer operations must build valid transactions
- **Test**: Various transfer scenarios (single, multi, different amounts)
- **Focus**: Edge cases like dust amounts, large transfers
- **Test Files**: `tests/transfer.js`, `tests/transferMulti.js`

### 4. HD Wallet Integration

- **Test**: Key derivation, address generation, signing
- **Focus**: Compatibility with standard BIP32/BIP44
- **Test File**: `tests/hdWallet.js`

### 5. Data Accuracy

- **Test**: Balance queries, UTXO retrieval, transaction history
- **Focus**: Ensure data matches blockchain state
- **Verification**: Cross-reference with block explorer

## Additional QA Testing Recommendations

### 1. Performance Testing

- Load test batch operations with 1000+ addresses
- Monitor memory usage during large batch operations
- Verify no memory leaks in long-running processes

### 2. Integration Testing

- Test SDK integration in a sample application
- Verify TypeScript types are correctly exported
- Test in both Node.js and browser environments (if applicable)

### 3. Security Review

- Ensure private keys are never logged or exposed
- Verify secure handling of HD wallet mnemonics
- Check for timing attacks in signature operations

### 4. Edge Case Testing

- Zero-value transfers
- Addresses with no MNEE tokens
- Malformed transaction data
- Network interruptions during operations

### 5. Compatibility Testing

- Node.js versions: 16.x, 18.x, 20.x
- TypeScript strict mode compliance
- CommonJS and ESM module formats

## Known Issues & Limitations

1. **Batch Processing**: When `continueOnError=true`, partial chunk failures now process items individually (recently fixed)
2. **Rate Limiting**: Server may timeout with aggressive rate limits (>10 req/s)
3. **Memory Usage**: Large batch operations (>500 items) should be monitored for memory consumption

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

- [ ] All 18 method tests pass
- [ ] All 9 batch tests pass
- [ ] No breaking changes to public API
- [ ] TypeScript definitions are accurate
- [ ] Package builds successfully
- [ ] Documentation is updated

## Reporting Issues

When reporting issues, please include:

1. Test file and specific test case
2. Error message and stack trace
3. Network being used (mainnet/sandbox/chipnet)
4. SDK version
5. Node.js version
6. Steps to reproduce

## Quick Validation Script

For rapid validation, QA can run:

```bash
# Quick smoke test
npm run build && node tests/batch/run-all.js
```

This runs all batch tests which exercise most SDK functionality.

## Contact & Support

For questions about test implementation or SDK behavior:

- Review existing test files for examples
- Check `temp/` directory for additional documentation
- Consult the main README.md for API documentation

---

**Note**: This SDK has undergone extensive testing during development. The existing test suite covers all major functionality and many edge cases. QA efforts should focus on validating the test suite accuracy, performance characteristics, and integration scenarios rather than basic functionality testing.
