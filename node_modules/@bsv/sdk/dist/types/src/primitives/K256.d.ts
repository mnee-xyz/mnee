import Mersenne from './Mersenne.js';
import BigNumber from './BigNumber.js';
/**
 * A class representing K-256, a prime number with optimizations, specifically used in the secp256k1 curve.
 * It extends the functionalities of the Mersenne class.
 * K-256 prime is represented as 'ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f'
 *
 * @class K256
 * @extends {Mersenne}
 *
 * @example
 * const k256 = new K256();
 */
export default class K256 extends Mersenne {
    /**
     * Constructor for the K256 class.
     * Creates an instance of K256 using the super constructor from Mersenne.
     *
     * @constructor
     *
     * @example
     * const k256 = new K256();
     */
    constructor();
    /**
     * Splits a BigNumber into a new BigNumber based on specific computation
     * rules. This method modifies the input and output big numbers.
     *
     * @method split
     * @param input - The BigNumber to be split.
     * @param output - The BigNumber that results from the split.
     *
     * @example
     * const input = new BigNumber(3456);
     * const output = new BigNumber(0);
     * k256.split(input, output);
     */
    split(input: BigNumber, output: BigNumber): void;
    /**
     * Multiplies a BigNumber ('num') with the constant 'K' in-place and returns the result.
     * 'K' is equal to 0x1000003d1 or in decimal representation: [ 64, 977 ].
     *
     * @method imulK
     * @param num - The BigNumber to multiply with K.
     * @returns Returns the mutated BigNumber after multiplication.
     *
     * @example
     * const number = new BigNumber(12345);
     * const result = k256.imulK(number);
     */
    imulK(num: BigNumber): BigNumber;
}
//# sourceMappingURL=K256.d.ts.map