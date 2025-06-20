import Mnee from './dist/index.module.js';

//TODO: Remove this file
async function testParseTx() {
  try {
    // Initialize MNEE service in production mode
    const mneeService = new Mnee({
      environment: 'production'
      // apiKey: 'your-api-key-here' // Uncomment and add your API key if needed
    });

    // Wait a moment for config to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Replace with the actual transaction ID you want to parse
    const txid = '1bead9a1dc4772c3f2a00a661defde48a7f7e4b79d3bf307a4c2ef20e1606e36';
    
    console.log(`Parsing transaction: ${txid}`);
    console.log('Please wait...\n');
    
    const result = await mneeService.parseTx(txid);
    
    console.log('Parse Transaction Result:');
    console.log('========================');
    console.log(`Transaction ID: ${result.txid}`);
    console.log(`Environment: ${result.environment}`);
    console.log(`Type: ${result.type}`);
    console.log('\nInputs:');
    result.inputs.forEach((input, index) => {
      console.log(`  ${index + 1}. Address: ${input.address}, Amount: ${input.amount}`);
    });
    console.log('\nOutputs:');
    result.outputs.forEach((output, index) => {
      console.log(`  ${index + 1}. Address: ${output.address}, Amount: ${output.amount}`);
    });
    
  } catch (error) {
    console.error('Error parsing transaction:', error.message);
    process.exit(1);
  }
}

// Run the test
testParseTx(); 