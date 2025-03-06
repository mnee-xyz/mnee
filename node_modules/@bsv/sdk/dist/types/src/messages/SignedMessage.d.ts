import PublicKey from '../primitives/PublicKey.js';
import PrivateKey from '../primitives/PrivateKey.js';
/**
 * Signs a message from one party to be verified by another, or for verification by anyone, using the BRC-77 message signing protocol.
 * @param message The message to sign
 * @param signer The private key of the message signer
 * @param [verifier] The public key of the person who can verify the message. If not provided, anyone will be able to verify the message signature.
 *
 * @returns The message signature.
 */
export declare const sign: (message: number[], signer: PrivateKey, verifier?: PublicKey) => number[];
/**
 * Verifies a message using the BRC-77 message signing protocol.
 * @param message The message to verify.
 * @param sig The message signature to be verified.
 * @param [recipient] The private key of the message verifier. This can be omitted if the message is verifiable by anyone.
 *
 * @returns True if the message is verified.
 */
export declare const verify: (message: number[], sig: number[], recipient?: PrivateKey) => boolean;
//# sourceMappingURL=SignedMessage.d.ts.map