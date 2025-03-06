import PublicKey from '../primitives/PublicKey.js';
import PrivateKey from '../primitives/PrivateKey.js';
/**
 * Encrypts a message from one party to another using the BRC-78 message encryption protocol.
 * @param message The message to encrypt
 * @param sender The private key of the sender
 * @param recipient The public key of the recipient
 *
 * @returns The encrypted message
 */
export declare const encrypt: (message: number[], sender: PrivateKey, recipient: PublicKey) => number[];
/**
 * Decrypts a message from one party to another using the BRC-78 message encryption protocol.
 * @param message The message to decrypt
 * @param sender The private key of the recipient
 *
 * @returns The decrypted message
 */
export declare const decrypt: (message: number[], recipient: PrivateKey) => number[];
//# sourceMappingURL=EncryptedMessage.d.ts.map