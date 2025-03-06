import BigNumber from './BigNumber.js';
import Mersenne from './Mersenne.js';
/**
 * A base reduction engine that provides several arithmetic operations over
 * big numbers under a modulus context. It's particularly suitable for
 * calculations required in cryptography algorithms and encoding schemas.
 *
 * @class ReductionContext
 *
 * @property prime - The prime number utilised in the reduction context, typically an instance of Mersenne class.
 * @property m - The modulus used for reduction operations.
 */
export default class ReductionContext {
    prime: Mersenne | null;
    m: BigNumber;
    /**
     * Constructs a new ReductionContext.
     *
     * @constructor
     * @param m - A BigNumber representing the modulus, or 'k256' to create a context for Koblitz curve.
     *
     * @example
     * new ReductionContext(new BigNumber(11));
     * new ReductionContext('k256');
     */
    constructor(m: BigNumber | 'k256');
    /**
     * Asserts that given value is truthy. Throws an Error with a provided message
     * if the value is falsy.
     *
     * @private
     * @param val - The value to be checked.
     * @param msg - The error message to be thrown if the value is falsy.
     *
     * @example
     * this.assert(1 < 2, '1 is not less than 2');
     * this.assert(2 < 1, '2 is less than 1'); // throws an Error with message '2 is less than 1'
     */
    private assert;
    /**
     * Verifies that a BigNumber is positive and red. Throws an error if these
     * conditions are not met.
     *
     * @param a - The BigNumber to be verified.
     *
     * @example
     * this.verify1(new BigNumber(10).toRed());
     * this.verify1(new BigNumber(-10).toRed()); //throws an Error
     * this.verify1(new BigNumber(10)); //throws an Error
     */
    verify1(a: BigNumber): void;
    /**
     * Verifies that two BigNumbers are both positive and red. Also checks
     * that they have the same reduction context. Throws an error if these
     * conditions are not met.
     *
     * @param a - The first BigNumber to be verified.
     * @param b - The second BigNumber to be verified.
     *
     * @example
     * this.verify2(new BigNumber(10).toRed(this), new BigNumber(20).toRed(this));
     * this.verify2(new BigNumber(-10).toRed(this), new BigNumber(20).toRed(this)); //throws an Error
     * this.verify2(new BigNumber(10).toRed(this), new BigNumber(20)); //throws an Error
     */
    verify2(a: BigNumber, b: BigNumber): void;
    /**
     * Performs an in-place reduction of the given BigNumber by the modulus of the reduction context, 'm'.
     *
     * @method imod
     *
     * @param a - BigNumber to be reduced.
     *
     * @returns Returns the reduced result.
     *
     * @example
     * const context = new ReductionContext(new BigNumber(7));
     * context.imod(new BigNumber(19)); // Returns 5
     */
    imod(a: BigNumber): BigNumber;
    /**
     * Negates a BigNumber in the context of the modulus.
     *
     * @method neg
     *
     * @param a - BigNumber to negate.
     *
     * @returns Returns the negation of 'a' in the reduction context.
     *
     * @example
     * const context = new ReductionContext(new BigNumber(7));
     * context.neg(new BigNumber(3)); // Returns 4
     */
    neg(a: BigNumber): BigNumber;
    /**
     * Performs the addition operation on two BigNumbers in the reduction context.
     *
     * @method add
     *
     * @param a - First BigNumber to add.
     * @param b - Second BigNumber to add.
     *
     * @returns Returns the result of 'a + b' in the reduction context.
     *
     * @example
     * const context = new ReductionContext(new BigNumber(5));
     * context.add(new BigNumber(2), new BigNumber(4)); // Returns 1
     */
    add(a: BigNumber, b: BigNumber): BigNumber;
    /**
     * Performs an in-place addition operation on two BigNumbers in the reduction context
     * in order to avoid creating a new BigNumber, it modifies the first one with the result.
     *
     * @method iadd
     *
     * @param a - First BigNumber to add.
     * @param b - Second BigNumber to add.
     *
     * @returns Returns the modified 'a' after addition with 'b' in the reduction context.
     *
     * @example
     * const context = new ReductionContext(new BigNumber(5));
     * const a = new BigNumber(2);
     * context.iadd(a, new BigNumber(4)); // Modifies 'a' to be 1
     */
    iadd(a: BigNumber, b: BigNumber): BigNumber;
    /**
     * Subtracts one BigNumber from another BigNumber in the reduction context.
     *
     * @method sub
     *
     * @param a - BigNumber to be subtracted from.
     * @param b - BigNumber to subtract.
     *
     * @returns Returns the result of 'a - b' in the reduction context.
     *
     * @example
     * const context = new ReductionContext(new BigNumber(7));
     * context.sub(new BigNumber(3), new BigNumber(2)); // Returns 1
     */
    sub(a: BigNumber, b: BigNumber): BigNumber;
    /**
     * Performs in-place subtraction of one BigNumber from another in the reduction context,
     * it modifies the first BigNumber with the result.
     *
     * @method isub
     *
     * @param a - BigNumber to be subtracted from.
     * @param b - BigNumber to subtract.
     *
     * @returns Returns the modified 'a' after subtraction of 'b' in the reduction context.
     *
     * @example
     * const context = new ReductionContext(new BigNumber(5));
     * const a = new BigNumber(4);
     * context.isub(a, new BigNumber(2)); // Modifies 'a' to be 2
     */
    isub(a: BigNumber, b: BigNumber): BigNumber;
    /**
     * Performs bitwise shift left operation on a BigNumber in the reduction context.
     *
     * @method shl
     *
     * @param a - BigNumber to perform shift on.
     * @param num - The number of positions to shift.
     *
     * @returns Returns the result of shifting 'a' left by 'num' positions in the reduction context.
     *
     * @example
     * const context = new ReductionContext(new BigNumber(32));
     * context.shl(new BigNumber(4), 2); // Returns 16
     */
    shl(a: BigNumber, num: number): BigNumber;
    /**
     * Performs in-place multiplication of two BigNumbers in the reduction context,
     * modifying the first BigNumber with the result.
     *
     * @method imul
     *
     * @param a - First BigNumber to multiply.
     * @param b - Second BigNumber to multiply.
     *
     * @returns Returns the modified 'a' after multiplication with 'b' in the reduction context.
     *
     * @example
     * const context = new ReductionContext(new BigNumber(7));
     * const a = new BigNumber(3);
     * context.imul(a, new BigNumber(2)); // Modifies 'a' to be 6
     */
    imul(a: BigNumber, b: BigNumber): BigNumber;
    /**
     * Multiplies two BigNumbers in the reduction context.
     *
     * @method mul
     *
     * @param a - First BigNumber to multiply.
     * @param b - Second BigNumber to multiply.
     *
     * @returns Returns the result of 'a * b' in the reduction context.
     *
     * @example
     * const context = new ReductionContext(new BigNumber(7));
     * context.mul(new BigNumber(3), new BigNumber(2)); // Returns 6
     */
    mul(a: BigNumber, b: BigNumber): BigNumber;
    /**
     * Calculates the square of a BigNumber in the reduction context,
     * modifying the original BigNumber with the result.
     *
     * @method isqr
     *
     * @param a - BigNumber to be squared.
     *
     * @returns Returns the squared 'a' in the reduction context.
     *
     * @example
     * const context = new ReductionContext(new BigNumber(7));
     * const a = new BigNumber(3);
     * context.isqr(a); // Modifies 'a' to be 2 (9 % 7 = 2)
     */
    isqr(a: BigNumber): BigNumber;
    /**
     * Calculates the square of a BigNumber in the reduction context.
     *
     * @method sqr
     *
     * @param a - BigNumber to be squared.
     *
     * @returns Returns the result of 'a^2' in the reduction context.
     *
     * @example
     * const context = new ReductionContext(new BigNumber(7));
     * context.sqr(new BigNumber(3)); // Returns 2 (9 % 7 = 2)
     */
    sqr(a: BigNumber): BigNumber;
    /**
     * Calculates the square root of a BigNumber in the reduction context.
     *
     * @method sqrt
     *
     * @param a - The BigNumber to calculate the square root of.
     *
     * @returns Returns the square root of 'a' in the reduction context.
     *
     * @example
     * const context = new ReductionContext(new BigNumber(9));
     * context.sqrt(new BigNumber(4)); // Returns 2
     */
    sqrt(a: BigNumber): BigNumber;
    /**
     * Calculates the multiplicative inverse of a BigNumber in the reduction context.
     *
     * @method invm
     *
     * @param a - The BigNumber to find the multiplicative inverse of.
     *
     * @returns Returns the multiplicative inverse of 'a' in the reduction context.
     *
     * @example
     * const context = new ReductionContext(new BigNumber(11));
     * context.invm(new BigNumber(3)); // Returns 4 (3*4 mod 11 = 1)
     */
    invm(a: BigNumber): BigNumber;
    /**
     * Raises a BigNumber to a power in the reduction context.
     *
     * @method pow
     *
     * @param a - The BigNumber to be raised to a power.
     * @param num - The power to raise the BigNumber to.
     *
     * @returns Returns the result of 'a' raised to the power of 'num' in the reduction context.
     *
     * @example
     * const context = new ReductionContext(new BigNumber(7));
     * context.pow(new BigNumber(3), new BigNumber(2)); // Returns 2 (3^2 % 7)
     */
    pow(a: BigNumber, num: BigNumber): BigNumber;
    /**
     * Converts a BigNumber to its equivalent in the reduction context.
     *
     * @method convertTo
     *
     * @param num - The BigNumber to convert to the reduction context.
     *
     * @returns Returns the converted BigNumber compatible with the reduction context.
     *
     * @example
     * const context = new ReductionContext(new BigNumber(7));
     * context.convertTo(new BigNumber(8)); // Returns 1 (8 % 7)
     */
    convertTo(num: BigNumber): BigNumber;
    /**
     * Converts a BigNumber from reduction context to its regular form.
     *
     * @method convertFrom
     *
     * @param num - The BigNumber to convert from the reduction context.
     *
     * @returns Returns the converted BigNumber in its regular form.
     *
     * @example
     * const context = new ReductionContext(new BigNumber(7));
     * const a = context.convertTo(new BigNumber(8)); // 'a' is now 1 in the reduction context
     * context.convertFrom(a); // Returns 1
     */
    convertFrom(num: BigNumber): BigNumber;
}
//# sourceMappingURL=ReductionContext.d.ts.map