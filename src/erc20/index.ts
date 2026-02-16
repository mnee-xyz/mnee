import { MneeErc20Service } from "./mneeErc20Service.js";
import { Environment, MNEEERC20Config } from "./mneeErc20.types.js";
import { Signer } from "ethers";

export default class MneeERC20 {
  private service: MneeErc20Service;

  constructor(env: Environment, privateKey: string) {
    this.service = new MneeErc20Service(env, privateKey);
  }

  /**
   * Retrieves the configuration for the MNEE service.
   *
   * @returns {Promise<MNEEConfig>} A promise that resolves to the MNEE configuration object.
   */
  async config(): Promise<MNEEERC20Config> {
    return this.service.getTokenMetadata();
  }

  /**
   * Retrieves the balance for a given address.
   *
   * @param address - The address to retrieve the balance for.
   * @returns A promise that resolves to a `MNEEBalance` object containing the balance details.
   */
  async balance(address: string): Promise<string> {
    return this.service.getBalance(address);
  }

  /**
   * Retrieves the balances for multiple addresses.
   *
   * @param addresses - An array of addresses to retrieve the balances for.
   * @returns A promise that resolves to an array of `MNEEBalance` objects containing the balance details for each address.
   */
  async balances(addresses: string[]): Promise<Record<string, string>> {
    return this.service.getBalances(addresses);
  }

  /**
   * Transfers the specified MNEE tokens using the provided WIF (Wallet Import Format) key.
   *
   * @param {to }  - An ERC20 address
   * @param {amount } - Amoount to send
   */
  async transfer(
    to: string,
    amount: string,
  ): Promise<string> {
    return this.service.transfer(to, amount);
  }
}
