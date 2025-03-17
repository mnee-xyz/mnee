import { MNEEBalance, MNEEConfig, ParseTxResponse, SendMNEE, TxHistoryResponse } from './mnee.types.js';
export declare class MNEEService {
    private mneeApiToken;
    private mneeApi;
    private gorillaPoolApi;
    private mneeConfig;
    constructor(apiToken?: string);
    getConfig(): Promise<MNEEConfig | undefined>;
    toAtomicAmount(amount: number): number;
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
    validateMneeTx(rawTx: string, request?: SendMNEE[]): Promise<boolean>;
    private getMneeSyncs;
    getRecentTxHistory(address: string, fromScore?: number, limit?: number): Promise<TxHistoryResponse>;
    parseTx(txid: string): Promise<ParseTxResponse>;
}
