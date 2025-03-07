import { MNEEBalance, MNEEConfig, SendMNEE } from "./mnee.types.js";
export declare class MNEEService {
    private mneeApiToken;
    private mneeApi;
    private gorillaPoolApi;
    constructor(apiToken?: string);
    /**
     * Fetches the MNEE configuration from the API.
     *
     * @returns {Promise<MNEEConfig | undefined>} A promise that resolves to the MNEE configuration object if successful, or undefined if an error occurs.
     *
     * @throws {Error} Throws an error if the HTTP request fails.
     */
    getConfig(): Promise<MNEEConfig | undefined>;
    /**
     * Converts a given amount to its atomic representation based on the specified number of decimals.
     *
     * @param amount - The amount to be converted.
     * @param decimals - The number of decimal places to consider for the atomic conversion.
     * @returns The atomic representation of the given amount.
     */
    toAtomicAmount(amount: number, decimals: number): number;
    private createInscription;
    private getUtxos;
    private broadcast;
    private fetchBeef;
    private getSignatures;
    /**
     * Transfers MNEE tokens to specified addresses.
     *
     * @param {SendMNEE[]} request - An array of transfer requests, each containing an address and amount.
     * @param {string} wif - The Wallet Import Format (WIF) string for the private key.
     * @returns {Promise<{ txid?: string; rawtx?: string; error?: string }>} - A promise that resolves to an object containing the transaction ID, raw transaction, or an error message.
     *
     * @throws {Error} If the configuration is not fetched, if the amount is invalid, if the MNEE balance is insufficient, if fee ranges are inadequate, if source transactions cannot be fetched, if signatures cannot be obtained, or if the transaction cannot be broadcast.
     */
    transfer(request: SendMNEE[], wif: string): Promise<{
        txid?: string;
        rawtx?: string;
        error?: string;
    }>;
    /**
     * Retrieves the balance for a given address.
     *
     * @param address - The address to fetch the balance for.
     * @returns A promise that resolves to an object containing the balance in both raw and decimal formats.
     * @throws Will throw an error if the configuration is not fetched successfully.
     *
     * @example
     * ```typescript
     * const balance = await mneeService.getBalance("some-address");
     * console.log(balance.amount); // Raw balance amount
     * console.log(balance.decimalAmount); // Balance amount in decimal format
     * ```
     */
    getBalance(address: string): Promise<MNEEBalance>;
}
