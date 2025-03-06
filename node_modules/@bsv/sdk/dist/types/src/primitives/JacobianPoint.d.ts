import BasePoint from './BasePoint.js';
import BigNumber from './BigNumber.js';
import Point from './Point.js';
/**
 * The `JacobianPoint` class extends the `BasePoint` class for handling Jacobian coordinates on an Elliptic Curve.
 * This class defines the properties and the methods needed to work with points in Jacobian coordinates.
 *
 * The Jacobian coordinates represent a point (x, y, z) on an Elliptic Curve such that the usual (x, y) coordinates are given by (x/z^2, y/z^3).
 *
 * @property x - The `x` coordinate of the point in the Jacobian form.
 * @property y - The `y` coordinate of the point in the Jacobian form.
 * @property z - The `z` coordinate of the point in the Jacobian form.
 * @property zOne - Flag that indicates if the `z` coordinate is one.
 *
 * @example
 * const pointJ = new JacobianPoint('3', '4', '1');
 */
export default class JacobianPoint extends BasePoint {
    x: BigNumber;
    y: BigNumber;
    z: BigNumber;
    zOne: boolean;
    /**
     * Constructs a new `JacobianPoint` instance.
     *
     * @param x - If `null`, the x-coordinate will default to the curve's defined 'one' constant.
     * If `x` is not a BigNumber, `x` will be converted to a `BigNumber` assuming it is a hex string.
     *
     * @param y - If `null`, the y-coordinate will default to the curve's defined 'one' constant.
     * If `y` is not a BigNumber, `y` will be converted to a `BigNumber` assuming it is a hex string.
     *
     * @param z - If `null`, the z-coordinate will default to 0.
     * If `z` is not a BigNumber, `z` will be converted to a `BigNumber` assuming it is a hex string.
     *
     * @example
     * const pointJ1 = new JacobianPoint(null, null, null); // creates point at infinity
     * const pointJ2 = new JacobianPoint('3', '4', '1'); // creates point (3, 4, 1)
     */
    constructor(x: string | BigNumber | null, y: string | BigNumber | null, z: string | BigNumber | null);
    /**
     * Converts the `JacobianPoint` object instance to standard affine `Point` format and returns `Point` type.
     *
     * @returns The `Point`(affine) object representing the same point as the original `JacobianPoint`.
     *
     * If the initial `JacobianPoint` represents point at infinity, an instance of `Point` at infinity is returned.
     *
     * @example
     * const pointJ = new JacobianPoint('3', '4', '1');
     * const pointP = pointJ.toP();  // The point in affine coordinates.
     */
    toP(): Point;
    /**
     * Negation operation. It returns the additive inverse of the Jacobian point.
     *
     * @method neg
     * @returns Returns a new Jacobian point as the result of the negation.
     *
     * @example
     * const jp = new JacobianPoint(x, y, z)
     * const result = jp.neg()
     */
    neg(): JacobianPoint;
    /**
     * Addition operation in the Jacobian coordinates. It takes a Jacobian point as an argument
     * and returns a new Jacobian point as a result of the addition. In the special cases,
     * when either one of the points is the point at infinity, it will return the other point.
     *
     * @method add
     * @param p - The Jacobian point to be added.
     * @returns Returns a new Jacobian point as the result of the addition.
     *
     * @example
     * const p1 = new JacobianPoint(x1, y1, z1)
     * const p2 = new JacobianPoint(x2, y2, z2)
     * const result = p1.add(p2)
     */
    add(p: JacobianPoint): JacobianPoint;
    /**
     * Mixed addition operation. This function combines the standard point addition with
     * the transformation from the affine to Jacobian coordinates. It first converts
     * the affine point to Jacobian, and then preforms the addition.
     *
     * @method mixedAdd
     * @param p - The affine point to be added.
     * @returns Returns the result of the mixed addition as a new Jacobian point.
     *
     * @example
     * const jp = new JacobianPoint(x1, y1, z1)
     * const ap = new Point(x2, y2)
     * const result = jp.mixedAdd(ap)
     */
    mixedAdd(p: Point): JacobianPoint;
    /**
     * Multiple doubling operation. It doubles the Jacobian point as many times as the pow parameter specifies. If pow is 0 or the point is the point at infinity, it will return the point itself.
     *
     * @method dblp
     * @param pow - The number of times the point should be doubled.
     * @returns Returns a new Jacobian point as the result of multiple doublings.
     *
     * @example
     * const jp = new JacobianPoint(x, y, z)
     * const result = jp.dblp(3)
     */
    dblp(pow: number): JacobianPoint;
    /**
     * Point doubling operation in the Jacobian coordinates. A special case is when the point is the point at infinity, in this case, this function will return the point itself.
     *
     * @method dbl
     * @returns Returns a new Jacobian point as the result of the doubling.
     *
     * @example
     * const jp = new JacobianPoint(x, y, z)
     * const result = jp.dbl()
     */
    dbl(): JacobianPoint;
    /**
     * Equality check operation. It checks whether the affine or Jacobian point is equal to this Jacobian point.
     *
     * @method eq
     * @param p - The affine or Jacobian point to compare with.
     * @returns Returns true if the points are equal, otherwise returns false.
     *
     * @example
     * const jp1 = new JacobianPoint(x1, y1, z1)
     * const jp2 = new JacobianPoint(x2, y2, z2)
     * const areEqual = jp1.eq(jp2)
     */
    eq(p: Point | JacobianPoint): boolean;
    /**
     * Equality check operation in relation to an x coordinate of a point in projective coordinates.
     * It checks whether the x coordinate of the Jacobian point is equal to the provided x coordinate
     * of a point in projective coordinates.
     *
     * @method eqXToP
     * @param x - The x coordinate of a point in projective coordinates.
     * @returns Returns true if the x coordinates are equal, otherwise returns false.
     *
     * @example
     * const jp = new JacobianPoint(x1, y1, z1)
     * const isXEqual = jp.eqXToP(x2)
     */
    eqXToP(x: BigNumber): boolean;
    /**
     * Returns the string representation of the JacobianPoint instance.
     * @method inspect
     * @returns Returns the string description of the JacobianPoint. If the JacobianPoint represents a point at infinity, the return value of this function is '<EC JPoint Infinity>'. For a normal point, it returns the string description format as '<EC JPoint x: x-coordinate y: y-coordinate z: z-coordinate>'.
     *
     * @example
     * const point = new JacobianPoint('5', '6', '1');
     * console.log(point.inspect()); // Output: '<EC JPoint x: 5 y: 6 z: 1>'
     */
    inspect(): string;
    /**
     * Checks whether the JacobianPoint instance represents a point at infinity.
     * @method isInfinity
     * @returns Returns true if the JacobianPoint's z-coordinate equals to zero (which represents the point at infinity in Jacobian coordinates). Returns false otherwise.
     *
     * @example
     * const point = new JacobianPoint('5', '6', '0');
     * console.log(point.isInfinity()); // Output: true
     */
    isInfinity(): boolean;
}
//# sourceMappingURL=JacobianPoint.d.ts.map