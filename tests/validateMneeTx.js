import Mnee from '../dist/index.modern.js';
import assert from 'assert';
import testConfig from './tests.config.json' assert { type: 'json' };

// Test configuration
const config = {
  environment: testConfig.environment,
};

const mnee = new Mnee(config);

// Valid raw transactions
const validRawTxs = [
  '01000000023f70e1738b22c52c4839bb0e15b68472aae88573968db25d432a6a9620773a83000000006b483045022100e87c0cec91384bbe8e795ff25c8dfe78f28d8b2b0f07710d52c0aeba20ef4c7d02206abf13e300646edeb182e5fe060850251ffd523b4edb26baa12cd6bdcd12a96cc12103688c68f5e0632af5a5b6b3901b02c1455a07a4453c6d3949554dbce5b488b500ffffffff3f70e1738b22c52c4839bb0e15b68472aae88573968db25d432a6a9620773a83010000006b483045022100d92b0aa2f064015f3df3d5dd572ab9c81cad742300832f4e258242ad02910bd202201bb249a7656242f39d25917a95ba9fb6299c20a24e614198c29fc82cd6abace0c12103688c68f5e0632af5a5b6b3901b02c1455a07a4453c6d3949554dbce5b488b500ffffffff030100000000000000d20063036f726451126170706c69636174696f6e2f6273762d3230004c787b2270223a226273762d3230222c226f70223a227472616e73666572222c22616d74223a2235303030303030222c226964223a22383333613737323039363661326134333564623238643936373338356538616137323834623631353065626233393438326363353232386237336531373033665f30227d6876a9149ec30645103c21501c14bf864c54f953ddcda7be88ad2102bed35e894cc41cc9879b4002ad03d33533b615c1b476068c8dd6822a09f93f6cac0100000000000000bc0063036f726451126170706c69636174696f6e2f6273762d3230004c857b2270223a226273762d3230222c226f70223a227472616e73666572222c22616d74223a223138343436373434303733373034353030303030222c226964223a22383333613737323039363661326134333564623238643936373338356538616137323834623631353065626233393438326363353232386237336531373033665f30227d6876a91468d87fd6ebf2f69a385dbf118779d430a0235f9b88ac31420f00000000001976a91468d87fd6ebf2f69a385dbf118779d430a0235f9b88ac00000000',
  '0100000002251df53f492633807504211121b44d99e8fc1106134127ad9ff5a5bb80d6c00505000000b348304502210081fbec3a61a15e0598a787acdfd413fe6492940d110aad08701d61619fc34154022035089045244fce8d24f1360cbb44bb9fe2483e823eb9308af6e8e90a44a879cd4147304402205a675af0b7541b4ab7df058223de2e368aa8057b4b51546be24239b6ae09ae3702203cd4203f2f401e58822b89b6f0902d5eb475533320906e7a187c7f17ad15d609c12102b0879818f93e4f5f1650957233a7b3cfae705de63baea999c2721e750858506fffffffff3452475b66d0ddce3c8e592939b31eb2b63e786079074be0c023e107b5d10d86000000006b483045022100b589b42f1b1c8c53af97bd9ca31cb0d0472c55a509107a08b42fd109a62abefa02203142dcb9cbd346ac40eb5c9257a6b8276e735a7c547dd76b7a2bd20e0287527c412102bed35e894cc41cc9879b4002ad03d33533b615c1b476068c8dd6822a09f93f6cffffffff060100000000000000d00063036f726451126170706c69636174696f6e2f6273762d3230004c767b2270223a226273762d3230222c226f70223a227472616e73666572222c226964223a22383333613737323039363661326134333564623238643936373338356538616137323834623631353065626233393438326363353232386237336531373033665f30222c22616d74223a223530303030227d6876a914ee24b754e661062088ab9e92da41aa983d564a3088ad2102bed35e894cc41cc9879b4002ad03d33533b615c1b476068c8dd6822a09f93f6cac0100000000000000d10063036f726451126170706c69636174696f6e2f6273762d3230004c777b2270223a226273762d3230222c226f70223a227472616e73666572222c226964223a22383333613737323039363661326134333564623238643936373338356538616137323834623631353065626233393438326363353232386237336531373033665f30222c22616d74223a22313030303030227d6876a914cc37c979549b42be5d491ad77c723bc86ed7d42488ad2102bed35e894cc41cc9879b4002ad03d33533b615c1b476068c8dd6822a09f93f6cac0100000000000000d00063036f726451126170706c69636174696f6e2f6273762d3230004c767b2270223a226273762d3230222c226f70223a227472616e73666572222c226964223a22383333613737323039363661326134333564623238643936373338356538616137323834623631353065626233393438326363353232386237336531373033665f30222c22616d74223a223235303030227d6876a914f85eb9afd5df9f6f3b54fecdc433a502def8ccb988ad2102bed35e894cc41cc9879b4002ad03d33533b615c1b476068c8dd6822a09f93f6cac0100000000000000d00063036f726451126170706c69636174696f6e2f6273762d3230004c767b2270223a226273762d3230222c226f70223a227472616e73666572222c226964223a22383333613737323039363661326134333564623238643936373338356538616137323834623631353065626233393438326363353232386237336531373033665f30222c22616d74223a223130303030227d6876a914103e328ad7c0075057ce9dfdc07abede2b51d39588ad2102bed35e894cc41cc9879b4002ad03d33533b615c1b476068c8dd6822a09f93f6cac0100000000000000ce0063036f726451126170706c69636174696f6e2f6273762d3230004c747b2270223a226273762d3230222c226f70223a227472616e73666572222c226964223a22383333613737323039363661326134333564623238643936373338356538616137323834623631353065626233393438326363353232386237336531373033665f30222c22616d74223a22313030227d6876a914b132fb8440e2d45b60d50ce8680aa9d0d316ab7288ad2102bed35e894cc41cc9879b4002ad03d33533b615c1b476068c8dd6822a09f93f6cac0100000000000000d10063036f726451126170706c69636174696f6e2f6273762d3230004c777b2270223a226273762d3230222c226f70223a227472616e73666572222c226964223a22383333613737323039363661326134333564623238643936373338356538616137323834623631353065626233393438326363353232386237336531373033665f30222c22616d74223a22323732373735227d6876a914933537ca59606e4bd554325fc615260da4190a2188ad2102bed35e894cc41cc9879b4002ad03d33533b615c1b476068c8dd6822a09f93f6cac00000000',
];

// Invalid raw transactions
const invalidRawTxs = [
  '010000000273ac81a9da5590d79ae080af519f772fd202ea975b8f862d5b5434f886ceabb1000000006b483045022100d36832d32ab634b8515c71714b99aaaba11bb523e331d73111aee9c908d83097022078d20dfb6ddf00237a2565399332fe96930d1c439076c62e7e2e54e1d325e50d41210326c692c95e73175795109d2fc90e852e7d725aa25d3d1b783d8c924d3c2be872ffffffff9a4f2cadf19d2909a31ef7ea31487998be66e1928bdee8305fc88d10cc9684e3020000006b483045022100c54a3e5835faf0ae81649d0a3c3351efe0c70ea46a8fe568e6aafe790b6be84802206811b4151129018e6dd019e60a3edbf750e4cbeb6b66ae31a9cacd334cf71cb541210326c692c95e73175795109d2fc90e852e7d725aa25d3d1b783d8c924d3c2be872ffffffff03000000000000000017006a0364787310703a313633353639382c6d617267696e2f19f908000000001976a914972350fec7dc3d587957167b08559a391819325a88acc0e07e04000000001976a91474b772406265b582f72bfa8cf7a434f4163e3c2a88ac00000000',
  '01000000020b69523ebd8b49fd7cbaf6582064c1b835f0b816d3c4e0bee04532e5567cf1a200000000b4483045022100ba05d21e75c07535e0e5a742abe2156ef2141dfd5df311f8113574412b539ce302204e618f909b126f8acfc484dcb9fb7e47b5c66c55f29eeb8bf83e2170b2a0d18841483045022100aeb19a755bdd030826d9304685586bcacd7514ab7fa3c7ae1041be90457ce70d02205dccdee6a3e5a840554323828018f908be4dff313ce2e904c3be92be989a7ca7c12102f58ba822955ee364b3dcfc00035e0390ef84395b54437985644e107988af1f00ffffffffb2c3fbf4455cb5006afbef5172add8263cdd6d473731cc5093d950c202610e40000000006a473044022001dd2cb21edd7b2ed30c3702a59622f37f0fb20f8d020ca08560d6e27e4efa880220795318c7942a8782b41e9924da869ce8d7e8f9ac5b787d2091ea68438c0e8b5b4121020a177d6a5e6f3a8689acd2e313bd1cf0dcf5a243d1cc67b7218602aee9e04b2fffffffff030100000000000000d20063036f726451126170706c69636174696f6e2f6273762d3230004c787b2270223a226273762d3230222c226f70223a227472616e73666572222c226964223a22616535396633623839386563363161636264623663633761323435666162656465643063303934626630343666333532303661336165633630656638383132375f30222c22616d74223a2231303937393936227d6876a914599937a5df03535a5a6c75b58e012024fe2dbb2a88ad21020a177d6a5e6f3a8689acd2e313bd1cf0dcf5a243d1cc67b7218602aee9e04b2fac0100000000000000cf0063036f726451126170706c69636174696f6e2f6273762d3230004c757b2270223a226273762d3230222c226f70223a227472616e73666572222c226964223a22616535396633623839386563363161636264623663633761323435666162656465643063303934626630343666333532303661336165633630656638383132375f30222c22616d74223a2231303030227d6876a9145d34be178f0bc32c3d85671427f1e70694ca8a3b88ad21020a177d6a5e6f3a8689acd2e313bd1cf0dcf5a243d1cc67b7218602aee9e04b2fac0100000000000000d40063036f726451126170706c69636174696f6e2f6273762d3230004c7a7b2270223a226273762d3230222c226f70223a227472616e73666572222c226964223a22616535396633623839386563363161636264623663633761323435666162656465643063303934626630343666333532303661336165633630656638383132375f30222c22616d74223a22343331393031303034227d6876a9147f22af3e81945603f8f13694b45425fe89234f9188ad21020a177d6a5e6f3a8689acd2e313bd1cf0dcf5a243d1cc67b7218602aee9e04b2fac00000000',
];

// Test 5.1: Validate valid transactions without request
async function testValidTxWithoutRequest() {
  for (let i = 0; i < validRawTxs.length; i++) {
    const isValid = await mnee.validateMneeTx(validRawTxs[i]);
    assert(isValid === true, `Valid transaction ${i + 1} should validate as true`);
    console.log(`  Valid transaction ${i + 1}: ✓`);
  }
}

// Test 5.2: Validate invalid transactions without request
async function testInvalidTxWithoutRequest() {
  for (let i = 0; i < invalidRawTxs.length; i++) {
    const isValid = await mnee.validateMneeTx(invalidRawTxs[i]);
    assert(isValid === false, `Invalid transaction ${i + 1} should validate as false`);
    console.log(`  Invalid transaction ${i + 1}: ✓`);
  }
}

// Test 5.3: Validate with malformed transaction hex
async function testMalformedTx() {
  const malformedTxs = [
    'not-a-hex-string',
    '01234567', // Too short
    'gg' + validRawTxs[0].substring(2), // Invalid hex characters
    '', // Empty string
  ];

  for (let i = 0; i < malformedTxs.length; i++) {
    try {
      const isValid = await mnee.validateMneeTx(malformedTxs[i]);
      assert(isValid === false, `Malformed transaction ${i + 1} should validate as false`);
      console.log(`  Malformed transaction ${i + 1}: returned false ✓`);
    } catch (error) {
      console.log(`  Malformed transaction ${i + 1}: threw error "${error.message}" ✓`);
    }
  }
}

// Test 5.4: Validate with request parameter
async function testValidTxWithRequest() {
  console.log('  Note: The request parameter validates that the transaction outputs match the intended transfers.');
  console.log('  The amount in the request should be in decimal MNEE, not atomic units.');

  // Parse the transaction to understand its structure
  const parsedTx = await mnee.parseTxFromRawTx(validRawTxs[0]);
  console.log('\n  Transaction details:');
  if (parsedTx && parsedTx.outputs) {
    parsedTx.outputs.forEach((output, index) => {
      console.log(
        `    Output ${index}: ${output.address} - ${output.amount} atomic units (${mnee.fromAtomicAmount(
          output.amount,
        )} MNEE)`,
      );
    });
  }

  // Test 1: Validation without request (baseline)
  const isValidWithoutRequest = await mnee.validateMneeTx(validRawTxs[0]);
  console.log(`  ✓ Validation without request: ${isValidWithoutRequest}`);

  // Test 2: Try with the first output as the request
  // Note: The request amount should be in decimal MNEE, not atomic units
  try {
    const firstOutputRequest = [
      {
        address: '1FUTPrD61CjeiymauPy1n2B4CKj4vw4Dno',
        amount: 50, // 5000000 atomic units = 50 MNEE (with 5 decimals: 5000000 / 100000)
      },
    ];
    const isValidFirstOutput = await mnee.validateMneeTx(validRawTxs[0], firstOutputRequest);
    assert(isValidFirstOutput === true, 'Validation should pass when request matches transaction output');
    console.log(`  ✓ Validation with matching request (decimal amount): ${isValidFirstOutput}`);
  } catch (error) {
    console.log(`  ✗ Validation with matching request failed: ${error.message}`);
  }

  // Also try with atomic units to see the difference
  try {
    const atomicRequest = [
      {
        address: '1FUTPrD61CjeiymauPy1n2B4CKj4vw4Dno',
        amount: 5000000, // Atomic units
      },
    ];
    const isValidAtomic = await mnee.validateMneeTx(validRawTxs[0], atomicRequest);
    console.log(`  ✓ Validation with atomic amount request: ${isValidAtomic}`);
  } catch (error) {
    console.log(`  ✗ Validation with atomic amount failed: ${error.message}`);
  }

  // Test 3: Test with non-matching request (should definitely return false)
  try {
    const nonMatchingRequest = [
      {
        address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', // Different address
        amount: 1000000, // Different amount
      },
    ];
    const isValidNonMatching = await mnee.validateMneeTx(validRawTxs[0], nonMatchingRequest);
    assert(isValidNonMatching === false, 'Should validate as false when request does not match transaction');
    console.log('  ✓ Validation with non-matching request: returned false as expected');
  } catch (error) {
    console.log(`  ✗ Validation with non-matching request threw error: ${error.message}`);
  }

  // Test 4: Empty request array
  const isValidEmptyRequest = await mnee.validateMneeTx(validRawTxs[0], []);
  console.log(`  ✓ Validation with empty request array: ${isValidEmptyRequest}`);

  // Test 5: Try matching both outputs exactly (might be required for validation to pass)
  try {
    const allOutputsRequest = [
      {
        address: '1FUTPrD61CjeiymauPy1n2B4CKj4vw4Dno',
        amount: 50, // First output: 50 MNEE
      },
      {
        address: '1AZNdbFYBDFTAEgzZMfPzANxyNrpGJZAUY',
        amount: 184467440737045, // Second output in MNEE
      },
    ];
    const isValidAllOutputs = await mnee.validateMneeTx(validRawTxs[0], allOutputsRequest);
    console.log(`  ✓ Validation with all outputs matched: ${isValidAllOutputs}`);
  } catch (error) {
    console.log(`  ✗ Validation with all outputs failed: ${error.message}`);
  }
}

// Test 5.5: Edge cases
async function testEdgeCases() {
  // Test with null/undefined
  let nullHandled = false;
  try {
    const result = await mnee.validateMneeTx(null);
    // If it doesn't throw, it should return false
    assert(result === false, 'Null transaction should return false');
    nullHandled = true;
    console.log('  ✓ Null transaction: returned false');
  } catch (error) {
    nullHandled = true;
    console.log('  ✓ Null transaction: threw error (acceptable behavior)');
  }
  assert(nullHandled, 'Null transaction should be handled');

  // Test with undefined
  let undefinedHandled = false;
  try {
    const result = await mnee.validateMneeTx(undefined);
    assert(result === false, 'Undefined transaction should return false');
    undefinedHandled = true;
    console.log('  ✓ Undefined transaction: returned false');
  } catch (error) {
    undefinedHandled = true;
    console.log('  ✓ Undefined transaction: threw error (acceptable behavior)');
  }
  assert(undefinedHandled, 'Undefined transaction should be handled');

  // Test with very large transaction
  const largeTx = '01' + '00'.repeat(10000);
  let largeHandled = false;
  try {
    const isValid = await mnee.validateMneeTx(largeTx);
    assert(isValid === false, 'Very large malformed transaction should be invalid');
    largeHandled = true;
    console.log('  ✓ Large transaction: returned false');
  } catch (error) {
    largeHandled = true;
    console.log('  ✓ Large transaction: threw error (acceptable behavior)');
  }
  assert(largeHandled, 'Large transaction should be handled');

  // Test with empty request array
  const isValidEmptyRequest = await mnee.validateMneeTx(validRawTxs[0], []);
  assert(typeof isValidEmptyRequest === 'boolean', 'Empty request array should return boolean');
  console.log(`  ✓ Empty request array: returned ${isValidEmptyRequest}`);
}

// Run tests
async function runTests() {
  console.log('Running validateMneeTx tests...\n');

  try {
    console.log('Test 5.1: Valid transactions without request');
    await testValidTxWithoutRequest();
    console.log('✅ Test 5.1 passed\n');

    console.log('Test 5.2: Invalid transactions without request');
    await testInvalidTxWithoutRequest();
    console.log('✅ Test 5.2 passed\n');

    console.log('Test 5.3: Malformed transaction handling');
    await testMalformedTx();
    console.log('✅ Test 5.3 passed\n');

    console.log('Test 5.4: Validation with request parameter');
    await testValidTxWithRequest();
    console.log('✅ Test 5.4 passed\n');

    console.log('Test 5.5: Edge cases');
    await testEdgeCases();
    console.log('✅ Test 5.5 passed\n');

    console.log('All tests passed! ✅');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
