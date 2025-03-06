import { MNEEBalance, SendMNEE } from "./mnee.types.js";
export interface MneeInterface {
    balance(address: string): Promise<MNEEBalance>;
    transfer(request: SendMNEE[], wif: string): Promise<{
        txid?: string;
        rawtx?: string;
        error?: string;
    }>;
}
export default class Mnee implements MneeInterface {
    private service;
    constructor(apiToken?: string);
    balance(address: string): Promise<MNEEBalance>;
    transfer(request: SendMNEE[], wif: string): Promise<{
        txid?: string;
        rawtx?: string;
        error?: string;
    }>;
}
