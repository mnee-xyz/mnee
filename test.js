import Mnee from './dist/index.modern.js';

const mnee = new Mnee({
  environment: 'sandbox',
});

var rawtx='invlaidRawTX1234567890';
const parsed = await mnee.parseTxFromRawTx(rawtx);
console.log('Parsed TX from RawTx:', parsed);