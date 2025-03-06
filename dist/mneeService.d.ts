import { MNEEBalance, SendMNEE } from "./mnee.types.js";
export declare class MNEEService {
    private mneeApiToken;
    private mneeApi;
    private gorillaPoolApi;
    constructor(apiToken?: string);
    private getConfig;
    private toAtomicAmount;
    private createInscription;
    private getUtxos;
    private broadcast;
    private fetchBeef;
    private getSignatures;
    transfer(request: SendMNEE[], wif: string): Promise<{
        txid?: string;
        rawtx?: string;
        error?: string;
    }>;
    getBalance(address: string): Promise<MNEEBalance>;
}
