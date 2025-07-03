import { MNEEService } from './mneeService.js';
import {
  MNEEBalance,
  MNEEConfig,
  SdkConfig,
  ParseTxResponse,
  ParseTxExtendedResponse,
  ParseOptions,
  SendMNEE,
  TransferResponse,
  TxHistoryResponse,
  AddressHistoryParams,
  Inscription,
  ParsedCosigner,
} from './mnee.types.js';
import { Script } from '@bsv/sdk';
export * from './mnee.types.js';

export interface MneeInterface {
  config(): Promise<MNEEConfig | undefined>;
  balance(address: string): Promise<MNEEBalance>;
  balances(addresses: string[]): Promise<MNEEBalance[]>;
  validateMneeTx(rawtx: string, request?: SendMNEE[]): Promise<boolean>;
  transfer(request: SendMNEE[], wif: string): Promise<TransferResponse>;
  toAtomicAmount(amount: number): number;
  fromAtomicAmount(amount: number): number;
  recentTxHistory(address: string, fromScore?: number, limit?: number): Promise<TxHistoryResponse>;
  recentTxHistories(params: AddressHistoryParams[]): Promise<TxHistoryResponse[]>;
  parseTx(txid: string, options?: ParseOptions): Promise<ParseTxResponse | ParseTxExtendedResponse>;
  parseTxFromRawTx(rawTxHex: string, options?: ParseOptions): Promise<ParseTxResponse | ParseTxExtendedResponse>;
  parseInscription(script: Script): Inscription | undefined;
  parseCosignerScripts(scripts: string[]): ParsedCosigner[];
}

/**
 * Represents the Mnee class that provides methods to interact with the MNEE service.
 */
export default class Mnee implements MneeInterface {
  private service: MNEEService;

  constructor(config: SdkConfig) {
    this.service = new MNEEService(config);
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
    return this.service.getCosignerConfig();
  }

  /**
   * Retrieves the balance for a given address.
   *
   * @param address - The address to retrieve the balance for.
   * @returns A promise that resolves to a `MNEEBalance` object containing the balance details.
   */
  async balance(address: string): Promise<MNEEBalance> {
    return this.service.getBalance(address);
  }

  /**
   * Retrieves the balances for multiple addresses.
   *
   * @param addresses - An array of addresses to retrieve the balances for.
   * @returns A promise that resolves to an array of `MNEEBalance` objects containing the balance details for each address.
   */
  async balances(addresses: string[]): Promise<MNEEBalance[]> {
    return this.service.getBalances(addresses);
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
   * Retrieves the recent transaction histories for multiple addresses.
   *
   * @param params - An array of address parameters, each containing an address, optional fromScore, and optional limit.
   * @returns A promise that resolves to an array of TxHistoryResponse objects containing the transaction
   * history for each address with its own pagination state.
   */
  async recentTxHistories(params: AddressHistoryParams[]): Promise<TxHistoryResponse[]> {
    return this.service.getRecentTxHistories(params);
  }

  /**
   * Parses a transaction based on the provided transaction ID.
   *
   * @param txid - The unique identifier of the transaction to be parsed.
   * @param options - Optional parsing options. Set includeRaw to true to get extended response with raw transaction data.
   * @returns A promise that resolves to a `ParseTxResponse` or `ParseTxExtendedResponse` containing the parsed transaction details.
   */
  async parseTx(txid: string, options?: ParseOptions): Promise<ParseTxResponse | ParseTxExtendedResponse> {
    return this.service.parseTx(txid, options);
  }

  /**
   * Parses a transaction from a raw transaction hex string.
   *
   * @param rawTxHex - The raw transaction hex string to be parsed.
   * @param options - Optional parsing options. Set includeRaw to true to get extended response with raw transaction data.
   * @returns A promise that resolves to a `ParseTxResponse` or `ParseTxExtendedResponse` containing the parsed transaction details.
   */
  async parseTxFromRawTx(rawTxHex: string, options?: ParseOptions): Promise<ParseTxResponse | ParseTxExtendedResponse> {
    return this.service.parseTxFromRawTx(rawTxHex, options);
  }

  /**
   * Parses an inscription.
   *
   * @param script - The script to be parsed.
   * @returns A `Inscription` object containing the parsed inscription details.
   */
  parseInscription(script: Script): Inscription | undefined {
    return this.service.parseInscription(script);
  }

  /**
   * Parses a cosigner script.
   *
   * @param scripts - The cosigner script to be parsed.
   * @returns A `ParsedCosigner` object containing the parsed cosigner details.
   */
  parseCosignerScripts(scripts: string[]): ParsedCosigner[] {
    return this.service.parseCosignerScripts(scripts);
  }
}
