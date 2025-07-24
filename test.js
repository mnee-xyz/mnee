import Mnee from './dist/index.modern.js';

const mnee = new Mnee({
  environment: 'sandbox',
});

const test = await mnee.transfer([]);
console.log(test);