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
  TransferMultiOptions,
  TxHistoryResponse,
  AddressHistoryParams,
  Inscription,
  ParsedCosigner,
  MNEEUtxo,
} from './mnee.types.js';
import { Script } from '@bsv/sdk';
import { HDWallet, HDWalletOptions } from './hdWallet.js';
import { Batch } from './batch.js';
export * from './mnee.types.js';

export interface MneeInterface {
  config(): Promise<MNEEConfig>;
  balance(address: string): Promise<MNEEBalance>;
  balances(addresses: string[]): Promise<MNEEBalance[]>;
  getUtxos(address: string | string[]): Promise<MNEEUtxo[]>;
  validateMneeTx(rawTxHex: string, request?: SendMNEE[]): Promise<boolean>;
  transfer(request: SendMNEE[], wif: string, broadcast?: boolean): Promise<TransferResponse>;
  transferMulti(options: TransferMultiOptions, broadcast?: boolean): Promise<TransferResponse>;
  submitRawTx(rawTxHex: string): Promise<TransferResponse>;
  toAtomicAmount(amount: number): number;
  fromAtomicAmount(amount: number): number;
  recentTxHistory(address: string, fromScore?: number, limit?: number): Promise<TxHistoryResponse>;
  recentTxHistories(params: AddressHistoryParams[]): Promise<TxHistoryResponse[]>;
  parseTx(txid: string, options?: ParseOptions): Promise<ParseTxResponse | ParseTxExtendedResponse>;
  parseTxFromRawTx(rawTxHex: string, options?: ParseOptions): Promise<ParseTxResponse | ParseTxExtendedResponse>;
  parseInscription(script: Script): Inscription | undefined;
  parseCosignerScripts(scripts: Script[]): ParsedCosigner[];
  HDWallet(mnemonic: string, options: HDWalletOptions): HDWallet;
  batch(): Batch;
}

/**
 * Represents the Mnee class that provides methods to interact with the MNEE service.
 */
export default class Mnee implements MneeInterface {
  private service: MNEEService;
  private _batch?: Batch;

  /**
   * Static reference to HDWallet class for accessing static methods
   * @example
   * const mnemonic = Mnee.HDWallet.generateMnemonic();
   * const isValid = Mnee.HDWallet.isValidMnemonic(mnemonic);
   */
  static HDWallet = HDWallet;

  constructor(config: SdkConfig) {
    this.service = new MNEEService(config);
  }

  /**
   * Validates an MNEE transaction.
   *
   * @param rawTxHex - The raw transaction hex string to validate.
   * @param request - An array of SendMNEE objects representing the transfer details. Use this parameter to validate the transaction against the specified transfer details. If it is not provided, it will only validate that the transaction is well-formed with the cosigner.
   * @returns A promise that resolves to a boolean indicating whether the transaction is valid.
   */
  async validateMneeTx(rawTxHex: string, request?: SendMNEE[]): Promise<boolean> {
    return this.service.validateMneeTx(rawTxHex, request);
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
   * @returns {Promise<MNEEConfig>} A promise that resolves to the MNEE configuration object.
   */
  async config(): Promise<MNEEConfig> {
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
   * Retrieves the UTXOs for a given address.
   *
   * @param address - The address to retrieve the UTXOs for.
   * @returns A promise that resolves to an array of `MNEEUtxo` objects containing the UTXO details.
   */
  async getUtxos(address: string | string[]): Promise<MNEEUtxo[]> {
    return this.service.getUtxos(address);
  }

  /**
   * Transfers the specified MNEE tokens using the provided WIF (Wallet Import Format) key.
   *
   * @param {SendMNEE[]} request - An array of SendMNEE objects representing the transfer details.
   * @param {string} wif - The Wallet Import Format key used to authorize the transfer.
   * @returns {Promise<TransferResponse>} A promise that resolves to a TransferResponse object containing the result of the transfer.
   */
  async transfer(request: SendMNEE[], wif: string, broadcast?: boolean): Promise<TransferResponse> {
    return this.service.transfer(request, wif, broadcast);
  }

  /**
   * Transfers MNEE tokens from multiple source UTXOs with different private keys. This is a more advanced method that allows you to control the UTXOs used in the transfer along with associated private keys.
   *
   * @param options - The transfer options including inputs, recipients, and optional change address.
   * @returns A promise that resolves to a TransferResponse object containing the result of the transfer.
   */
  async transferMulti(options: TransferMultiOptions, broadcast?: boolean): Promise<TransferResponse> {
    return this.service.transferMulti(options, broadcast);
  }

  /**
   * Submits a partially signed raw transaction to the MNEE network. This is useful when you have a raw transaction hex string that you have already signed, but you need to submit it to the MNEE network.
   *
   * @param rawTxHex - The raw transaction hex string to submit.
   * @returns A promise that resolves to a TransferResponse object containing the result of the transfer.
   */
  async submitRawTx(rawTxHex: string): Promise<TransferResponse> {
    return this.service.submitRawTx(rawTxHex);
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
   * Parses cosigner scripts to extract cosigner public keys and addresses.
   *
   * @param scripts - An array of Script objects to be parsed.
   * @returns An array of `ParsedCosigner` objects containing the parsed cosigner details.
   */
  parseCosignerScripts(scripts: Script[]): ParsedCosigner[] {
    return this.service.parseCosignerScripts(scripts);
  }

  /**
   * Creates a new HDWallet instance for managing hierarchical deterministic wallets.
   * @param mnemonic - The BIP39 mnemonic phrase
   * @param options - Configuration options for the HD wallet
   * @returns A new HDWallet instance
   * @example
   * const mnee = new Mnee(config);
   * const hdWallet = mnee.HDWallet(mnemonic, {
   *   derivationPath: "m/44'/236'/0'",
   *   cacheSize: 1000
   * });
   */
  HDWallet(mnemonic: string, options: HDWalletOptions): HDWallet {
    return new HDWallet(mnemonic, options);
  }

  /**
   * Returns a Batch instance for performing batch operations
   * @returns A Batch instance for batch processing
   * @example
   * const batch = mnee.batch();
   * const balances = await batch.getBalances(addresses);
   * const utxos = await batch.getUtxos(addresses);
   */
  batch(): Batch {
    if (!this._batch) {
      this._batch = new Batch(this.service);
    }
    return this._batch;
  }
}
