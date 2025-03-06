import { LockingScript, type PrivateKey, type PublicKey, type Script, type ScriptTemplate, type Transaction, UnlockingScript } from "@bsv/sdk";
/**
 * P2PKH (Pay To Public Key Hash) class implementing ScriptTemplate.
 *
 * This class provides methods to create Pay To Public Key Hash locking and unlocking scripts, including the unlocking of P2PKH UTXOs with the private key.
 */
export default class CosignTemplate implements ScriptTemplate {
    /**
     * Creates a P2PKH locking script for a given public key hash or address string
     *
     * @param {number[] | string} userPKHash or address - An array or address representing the public key hash of the owning user.
     * @param {PublicKey} approverPubKey - Public key of the approver.
     * @returns {LockingScript} - A P2PKH locking script.
     */
    lock(userPKHash: string | number[], approverPubKey: PublicKey): LockingScript;
    /**
     * Creates a function that generates a P2PKH unlocking script along with its signature and length estimation.
     *
     * The returned object contains:
     * 1. `sign` - A function that, when invoked with a transaction and an input index,
     *    produces an unlocking script suitable for a P2PKH locked output.
     * 2. `estimateLength` - A function that returns the estimated length of the unlocking script in bytes.
     *
     * @param {PrivateKey} userPrivateKey - The private key used for signing the transaction.
     * @param {'all'|'none'|'single'} signOutputs - The signature scope for outputs.
     * @param {boolean} anyoneCanPay - Flag indicating if the signature allows for other inputs to be added later.
     * @param {number} sourceSatoshis - Optional. The amount being unlocked. Otherwise the input.sourceTransaction is required.
     * @param {Script} lockingScript - Optional. The lockinScript. Otherwise the input.sourceTransaction is required.
     * @returns {Object} - An object containing the `sign` and `estimateLength` functions.
     */
    userUnlock(userPrivateKey: PrivateKey, signOutputs?: "all" | "none" | "single", anyoneCanPay?: boolean, sourceSatoshis?: number, lockingScript?: Script): {
        sign: (tx: Transaction, inputIndex: number) => Promise<UnlockingScript>;
        estimateLength: () => Promise<182>;
    };
    /**
     * Creates a function that generates a P2PKH unlocking script along with its signature and length estimation.
     *
     * The returned object contains:
     * 1. `sign` - A function that, when invoked with a transaction and an input index,
     *    produces an unlocking script suitable for a P2PKH locked output.
     * 2. `estimateLength` - A function that returns the estimated length of the unlocking script in bytes.
     *
     * @param {PrivateKey} approverPrivateKey - The private key used for signing the transaction.
     * @param {'all'|'none'|'single'} signOutputs - The signature scope for outputs.
     * @param {boolean} anyoneCanPay - Flag indicating if the signature allows for other inputs to be added later.
     * @param {number} sourceSatoshis - Optional. The amount being unlocked. Otherwise the input.sourceTransaction is required.
     * @param {Script} lockingScript - Optional. The lockinScript. Otherwise the input.sourceTransaction is required.
     * @returns {Object} - An object containing the `sign` and `estimateLength` functions.
     */
    unlock(approverPrivateKey: PrivateKey, userSigScript: Script, signOutputs?: "all" | "none" | "single", anyoneCanPay?: boolean, sourceSatoshis?: number, lockingScript?: Script): {
        sign: (tx: Transaction, inputIndex: number) => Promise<UnlockingScript>;
        estimateLength: () => Promise<182>;
    };
}
