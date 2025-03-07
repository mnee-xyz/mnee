import { MNEEService } from "./mneeService.js";
import { MNEEBalance, MNEEConfig, SendMNEE } from "./mnee.types.js";
export * from "./mnee.types.js";

export interface MneeInterface {
  config(): Promise<MNEEConfig | undefined>;
  balance(address: string): Promise<MNEEBalance>;
  transfer(
    request: SendMNEE[],
    wif: string
  ): Promise<{ txid?: string; rawtx?: string; error?: string }>;
  toAtomicAmount(amount: number, decimals: number): number;
}

export default class Mnee implements MneeInterface {
  private service: MNEEService;

  constructor(apiToken?: string) {
    this.service = new MNEEService(apiToken);
  }

  toAtomicAmount(amount: number, decimals: number): number {
    return this.service.toAtomicAmount(amount, decimals);
  }

  async config(): Promise<MNEEConfig | undefined> {
    return this.service.getConfig();
  }

  async balance(address: string): Promise<MNEEBalance> {
    return this.service.getBalance(address);
  }

  async transfer(request: SendMNEE[], wif: string) {
    return this.service.transfer(request, wif);
  }
}
