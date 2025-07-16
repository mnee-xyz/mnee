# MNEE SDK Test Coverage TODOs

## Test Files Status

- [x] config() - `tests/config.js` ✅ COMPLETED
- [x] balance() - `tests/balance.js` ✅ COMPLETED
- [x] balances() - `tests/balances.js` ✅ COMPLETED
- [x] getUtxos() - `tests/getUtxos.js` ✅ COMPLETED
- [x] validateMneeTx() - `tests/validateMneeTx.js` ✅ COMPLETED
- [x] transfer() - `tests/transfer.js` ✅ COMPLETED
- [x] transferMulti() - `tests/transferMulti.js` ✅ COMPLETED
- [x] submitRawTx() - `tests/submitRawTx.js` ✅ COMPLETED
- [x] toAtomicAmount() - `tests/toAtomicAmount.js` ✅ COMPLETED
- [x] fromAtomicAmount() - `tests/fromAtomicAmount.js` ✅ COMPLETED
- [x] recentTxHistory() - `tests/recentTxHistory.js` ✅ COMPLETED
- [x] recentTxHistories() - `tests/recentTxHistories.js` ✅ COMPLETED
- [x] parseTx() - `tests/parseTx.js` ✅ COMPLETED
- [x] parseTxFromRawTx() - `tests/parseTxFromRawTx.js` ✅ COMPLETED
- [x] parseInscription() - `tests/parseInscription.js` ✅ COMPLETED
- [x] parseCosignerScripts() - `tests/parseCosignerScripts.js` ✅ COMPLETED
- [ ] HDWallet() - `tests/hdWallet.js`
- [ ] batch() - `tests/batch.js`

## Test Pattern
Each test file follows the same structure as `config.js`:
1. Import Mnee and assert
2. Initialize Mnee with sandbox config
3. Create test functions for different scenarios
4. Run tests with proper error handling
5. Display results with console logs

## Progress Notes
- Started: config() method testing
- Next: Continue with balance() method