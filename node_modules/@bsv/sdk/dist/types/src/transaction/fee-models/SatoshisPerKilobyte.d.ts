import FeeModel from '../FeeModel.js';
import Transaction from '../Transaction.js';
/**
 * Represents the "satoshis per kilobyte" transaction fee model.
 */
export default class SatoshisPerKilobyte implements FeeModel {
    /**
     * @property
     * Denotes the number of satoshis paid per kilobyte of transaction size.
     */
    value: number;
    /**
     * Constructs an instance of the sat/kb fee model.
     *
     * @param {number} value - The number of satoshis per kilobyte to charge as a fee.
     */
    constructor(value: number);
    /**
     * Computes the fee for a given transaction.
     *
     * @param tx The transaction for which a fee is to be computed.
     * @returns The fee in satoshis for the transaction, as a BigNumber.
     */
    computeFee(tx: Transaction): Promise<number>;
}
//# sourceMappingURL=SatoshisPerKilobyte.d.ts.map