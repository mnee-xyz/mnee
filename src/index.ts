import { MNEEService } from "./mneeService.js";
import { MNEEBalance, SendMNEE } from "./mnee.types.js";

export interface MneeInterface {
  balance(address: string): Promise<MNEEBalance>;
  transfer(
    request: SendMNEE[],
    wif: string
  ): Promise<{ txid?: string; rawtx?: string; error?: string }>;
}

export default class Mnee implements MneeInterface {
  private service: MNEEService;

  constructor(apiToken?: string) {
    this.service = new MNEEService(apiToken);
  }

  async balance(address: string): Promise<MNEEBalance> {
    return this.service.getBalance(address);
  }

  async transfer(request: SendMNEE[], wif: string) {
    return this.service.transfer(request, wif);
  }
}
