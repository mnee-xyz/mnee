import { MNEEBalance, MNEEConfig, SendMNEE, TransferResponse } from './mnee.types.js';
export * from './mnee.types.js';
export interface MneeInterface {
    config(): Promise<MNEEConfig | undefined>;
    balance(address: string): Promise<MNEEBalance>;
    validateMneeTx(rawtx: string, request?: SendMNEE[]): Promise<boolean>;
    transfer(request: SendMNEE[], wif: string): Promise<TransferResponse>;
    toAtomicAmount(amount: number, decimals: number): number;
}
/**
 * Represents the Mnee class that provides methods to interact with the MNEE service.
 */
export default class Mnee implements MneeInterface {
    private service;
    constructor(apiToken?: string);
    /**
     * Validates an MNEE transaction.
     *
     * @param rawtx - The raw transaction to validate.
     * @param request - An array of SendMNEE objects representing the transfer details. Use this parameter to validate the transaction against the specified transfer details. If it is not provided, it will only validate that the transaction is well-formed with the cosigner.
     * @returns A promise that resolves to a boolean indicating whether the transaction is valid.
     */
    validateMneeTx(rawtx: string, request?: SendMNEE[]): Promise<boolean>;
    /**
     * Converts a given amount to its atomic representation based on the specified number.
     *
     * @param amount - The amount to be converted.
     * @returns The atomic representation of the given amount.
     *
     * @example
     * ```typescript
     * toAtomicAmount(1.5); // 150000
     * ```
     */
    toAtomicAmount(amount: number): number;
    /**
     * Retrieves the configuration for the MNEE service.
     *
     * @returns {Promise<MNEEConfig | undefined>} A promise that resolves to the MNEE configuration object,
     * or undefined if the configuration could not be retrieved.
     */
    config(): Promise<MNEEConfig | undefined>;
    /**
     * Retrieves the balance for a given address.
     *
     * @param address - The address to retrieve the balance for.
     * @returns A promise that resolves to an MNEEBalance object containing the balance information.
     */
    balance(address: string): Promise<MNEEBalance>;
    /**
     * Transfers the specified MNEE tokens using the provided WIF (Wallet Import Format) key.
     *
     * @param {SendMNEE[]} request - An array of SendMNEE objects representing the transfer details.
     * @param {string} wif - The Wallet Import Format key used to authorize the transfer.
     * @returns {Promise<TransferResponse>} A promise that resolves to a TransferResponse object containing the result of the transfer.
     */
    transfer(request: SendMNEE[], wif: string): Promise<TransferResponse>;
}
