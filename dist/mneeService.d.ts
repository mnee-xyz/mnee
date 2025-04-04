import { MNEEBalance, MNEEConfig, SdkConfig, ParseTxResponse, SendMNEE, TxHistoryResponse } from './mnee.types.js';
export declare class MNEEService {
    private readonly prodTokenId;
    private readonly prodApprover;
    private readonly prodAddress;
    private readonly devTokenId;
    private readonly devAddress;
    private readonly qaTokenId;
    private readonly qaAddress;
    private readonly stageTokenId;
    private readonly stageAddress;
    private readonly productionMneeApi;
    private readonly sandboxMneeApi;
    private readonly gorillaPoolApi;
    private mneeApiKey;
    private mneeConfig;
    private mneeApi;
    constructor(config: SdkConfig);
    getCosignerConfig(): Promise<MNEEConfig | undefined>;
    toAtomicAmount(amount: number): number;
    fromAtomicAmount(amount: number): number;
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
    private parseTransaction;
    parseTx(txid: string): Promise<ParseTxResponse>;
    parseTxFromRawTx(rawTxHex: string): Promise<ParseTxResponse>;
}
