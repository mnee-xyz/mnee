import BigNumber from './BigNumber.js';
/**
 * A representation of a pseudo-Mersenne prime.
 * A pseudo-Mersenne prime has the general form 2^n - k, where n and k are integers.
 *
 * @class Mersenne
 *
 * @property name - The identifier for the Mersenne instance.
 * @property p - BigNumber equivalent to 2^n - k.
 * @property k - The constant subtracted from 2^n to derive a pseudo-Mersenne prime.
 * @property n - The exponent which determines the magnitude of the prime.
 */
export default class Mersenne {
    name: string;
    p: BigNumber;
    k: BigNumber;
    n: number;
    private readonly tmp;
    /**
     * @constructor
     * @param name - An identifier for the Mersenne instance.
     * @param p - A string representation of the pseudo-Mersenne prime, expressed in hexadecimal.
     *
     * @example
     * const mersenne = new Mersenne('M31', '7FFFFFFF');
     */
    constructor(name: string, p: string);
    /**
     * Creates a temporary BigNumber structure for computations,
     * ensuring the appropriate number of words are initially allocated.
     *
     * @method _tmp
     * @returns A BigNumber with scaled size depending on prime magnitude.
     */
    private _tmp;
    /**
     * Reduces an input BigNumber in place, under the assumption that
     * it is less than the square of the pseudo-Mersenne prime.
     *
     * @method ireduce
     * @param num - The BigNumber to be reduced.
     * @returns The reduced BigNumber.
     *
     * @example
     * const reduced = mersenne.ireduce(new BigNumber('2345', 16));
     */
    ireduce(num: BigNumber): BigNumber;
    /**
     * Shifts bits of the input BigNumber to the right, in place,
     * to meet the magnitude of the pseudo-Mersenne prime.
     *
     * @method split
     * @param input - The BigNumber to be shifted.
     * @param out - The BigNumber to hold the shifted result.
     *
     * @example
     * mersenne.split(new BigNumber('2345', 16), new BigNumber());
     */
    split(input: BigNumber, out: BigNumber): void;
    /**
     * Performs an in-place multiplication of the parameter by constant k.
     *
     * @method imulK
     * @param num - The BigNumber to multiply with k.
     * @returns The result of the multiplication, in BigNumber format.
     *
     * @example
     * const multiplied = mersenne.imulK(new BigNumber('2345', 16));
     */
    imulK(num: BigNumber): BigNumber;
}
//# sourceMappingURL=Mersenne.d.ts.map