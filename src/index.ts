import { MNEEService } from './mneeService.js';
import {
  MNEEBalance,
  MNEEConfig,
  ParseTxResponse,
  SendMNEE,
  TransferResponse,
  TxHistoryResponse,
} from './mnee.types.js';
export * from './mnee.types.js';

export interface MneeInterface {
  config(): Promise<MNEEConfig | undefined>;
  balance(address: string): Promise<MNEEBalance>;
  validateMneeTx(rawtx: string, request?: SendMNEE[]): Promise<boolean>;
  transfer(request: SendMNEE[], wif: string): Promise<TransferResponse>;
  toAtomicAmount(amount: number): number;
  fromAtomicAmount(amount: number): number;
  recentTxHistory(address: string, fromScore?: number, limit?: number): Promise<TxHistoryResponse>;
  parseTx(txid: string): Promise<ParseTxResponse>;
}

/**
 * Represents the Mnee class that provides methods to interact with the MNEE service.
 */
export default class Mnee implements MneeInterface {
  private service: MNEEService;

  constructor(apiToken?: string) {
    this.service = new MNEEService(apiToken);
  }

  /**
   * Validates an MNEE transaction.
   *
   * @param rawtx - The raw transaction to validate.
   * @param request - An array of SendMNEE objects representing the transfer details. Use this parameter to validate the transaction against the specified transfer details. If it is not provided, it will only validate that the transaction is well-formed with the cosigner.
   * @returns A promise that resolves to a boolean indicating whether the transaction is valid.
   */
  async validateMneeTx(rawtx: string, request?: SendMNEE[]): Promise<boolean> {
    return this.service.validateMneeTx(rawtx, request);
  }

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
  toAtomicAmount(amount: number): number {
    return this.service.toAtomicAmount(amount);
  }

  /**
   * Converts a given atomic amount to its human-readable representation.
   *
   * @param amount - The atomic amount to be converted.
   * @returns The human-readable representation of the given atomic amount.
   *
   * @example
   * ```typescript
   * fromAtomicAmount(150000); // 1.5
   * ```
   */
  fromAtomicAmount(amount: number): number {
    return this.service.fromAtomicAmount(amount);
  }

  /**
   * Retrieves the configuration for the MNEE service.
   *
   * @returns {Promise<MNEEConfig | undefined>} A promise that resolves to the MNEE configuration object,
   * or undefined if the configuration could not be retrieved.
   */
  async config(): Promise<MNEEConfig | undefined> {
    return this.service.getConfig();
  }

  /**
   * Retrieves the balance for a given address.
   *
   * @param address - The address to retrieve the balance for.
   * @returns A promise that resolves to an MNEEBalance object containing the balance information.
   */
  async balance(address: string): Promise<MNEEBalance> {
    return this.service.getBalance(address);
  }

  /**
   * Transfers the specified MNEE tokens using the provided WIF (Wallet Import Format) key.
   *
   * @param {SendMNEE[]} request - An array of SendMNEE objects representing the transfer details.
   * @param {string} wif - The Wallet Import Format key used to authorize the transfer.
   * @returns {Promise<TransferResponse>} A promise that resolves to a TransferResponse object containing the result of the transfer.
   */
  async transfer(request: SendMNEE[], wif: string): Promise<TransferResponse> {
    return this.service.transfer(request, wif);
  }

  /**
   * Retrieves the recent transaction history for a given address.
   *
   * @param address - The address to retrieve the transaction history for.
   * @param fromScore - The starting score to retrieve the transaction history from.
   * @param limit - The maximum number of transactions to retrieve.
   * @returns A promise that resolves to a TxHistoryResponse object containing the transaction
   * history and the next score to retrieve additional transactions.
   */
  async recentTxHistory(address: string, fromScore?: number, limit?: number): Promise<TxHistoryResponse> {
    return this.service.getRecentTxHistory(address, fromScore, limit);
  }

  /**
   * Parses a transaction based on the provided transaction ID.
   *
   * @param txid - The unique identifier of the transaction to be parsed.
   * @returns A promise that resolves to a `ParseTxResponse` containing the parsed transaction details.
   */
  async parseTx(txid: string): Promise<ParseTxResponse> {
    return this.service.parseTx(txid);
  }
}
