import { MNEEBalance, MNEEConfig, SendMNEE } from "./mnee.types.js";
export interface MneeInterface {
    config(): Promise<MNEEConfig | undefined>;
    balance(address: string): Promise<MNEEBalance>;
    transfer(request: SendMNEE[], wif: string): Promise<{
        txid?: string;
        rawtx?: string;
        error?: string;
    }>;
    toAtomicAmount(amount: number, decimals: number): number;
}
export default class Mnee implements MneeInterface {
    private service;
    constructor(apiToken?: string);
    toAtomicAmount(amount: number, decimals: number): number;
    config(): Promise<MNEEConfig | undefined>;
    balance(address: string): Promise<MNEEBalance>;
    transfer(request: SendMNEE[], wif: string): Promise<{
        txid?: string;
        rawtx?: string;
        error?: string;
    }>;
}
