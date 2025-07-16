# Batch Tests

This directory contains individual test files for the MNEE SDK batch operations.

## Running Tests

### Run all tests:
```bash
node tests/batch/run-all.js
```

### Run individual tests:
```bash
node tests/batch/01-instance-creation.js
node tests/batch/02-get-balances.js
node tests/batch/03-get-utxos.js
node tests/batch/04-get-tx-histories.js
node tests/batch/05-parse-tx.js
node tests/batch/06-error-handling.js
node tests/batch/07-rate-limiting.js
node tests/batch/08-hd-wallet-integration.js
node tests/batch/09-edge-cases.js
```

## Test Descriptions

1. **01-instance-creation.js** - Tests batch instance creation and singleton behavior
2. **02-get-balances.js** - Tests batch balance fetching with various options
3. **03-get-utxos.js** - Tests batch UTXO retrieval and progress tracking
4. **04-get-tx-histories.js** - Tests batch transaction history fetching
5. **05-parse-tx.js** - Tests batch transaction parsing
6. **06-error-handling.js** - Tests error handling, retry logic, and continueOnError
7. **07-rate-limiting.js** - Tests rate limiting and concurrency settings
8. **08-hd-wallet-integration.js** - Tests batch operations with HD wallet addresses
9. **09-edge-cases.js** - Tests edge cases like duplicates, empty arrays, etc.

## Configuration

All tests use:
- API rate limit: 10 requests/second (configured for your API key)
- Test environment: Configured in `tests.config.json`
- Shared setup: Available in `setup.js`