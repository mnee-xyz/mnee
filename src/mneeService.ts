import {
  Hash,
  P2PKH,
  PrivateKey,
  PublicKey,
  Script,
  Transaction,
  TransactionSignature,
  UnlockingScript,
  Utils,
  OP,
  LockingScript,
} from '@bsv/sdk';
import {
  Environment,
  GetSignatures,
  MNEEBalance,
  MNEEConfig,
  MNEEFee,
  MneeInscription,
  SdkConfig,
  MneeSync,
  MNEEUtxo,
  ParseTxResponse,
  ParseTxExtendedResponse,
  ParseOptions,
  SendMNEE,
  TransferMultiOptions,
  SignatureRequest,
  SignatureResponse,
  TxHistory,
  TxHistoryResponse,
  TxOperation,
  AddressHistoryParams,
  TxAddressAmount,
  TransferResponse,
  TransferStatus,
  TxInputResponse,
  ProcessedInput,
  TxOutputResponse,
  ProcessedOutput,
  TransferOptions,
  BalanceResponse,
  MultisigBuildOptions,
  UnsignedTransactionResult,
} from './mnee.types.js';
import CosignTemplate from './mneeCosignTemplate.js';
import { applyInscription } from './utils/applyInscription.js';
import {
  isValidHex,
  parseCosignerScripts,
  parseInscription,
  parseSyncToTxHistory,
  validateAddress,
  validateTransferMultiOptions,
  validateTransferOptions,
} from './utils/helper.js';
import { isNetworkError, logNetworkError } from './utils/networkError.js';
import { stacklessError } from './utils/stacklessError.js';
import {
  MNEE_PROXY_API_URL,
  SANDBOX_MNEE_API_URL,
  PROD_TOKEN_ID,
  PROD_MINT_ADDRESS,
  PROD_APPROVER,
  PUBLIC_PROD_MNEE_API_TOKEN,
  PUBLIC_SANDBOX_MNEE_API_TOKEN,
  SANDBOX_TOKEN_ID,
  SANDBOX_MINT_ADDRESS,
  SANDBOX_APPROVER,
  MNEE_DECIMALS,
} from './constants.js';
import { RateLimiter } from './batch.js';

export class MNEEService {
  private mneeApiKey: string;
  private mneeConfig: MNEEConfig | undefined;
  private configReady: Promise<MNEEConfig>;
  private mneeApi: string;
  private static readonly TX_CACHE_MAX = 5000;
  private static readonly OUTPOINT_LOCK_TTL = 35_000;
  private static readonly LOCK_RETRY_MAX = 3;
  private static readonly LOCK_RETRY_BACKOFF_MS = 250;
  private readonly txFetchCache = new Map<string, Promise<Transaction | undefined>>();
  private readonly inputFetchLimiter = new RateLimiter(3, 334);
  private readonly usedOutpoints = new Map<string, number>();

  constructor(config: SdkConfig) {
    if (config.environment !== 'production' && config.environment !== 'sandbox') {
      throw stacklessError('Invalid environment. Must be either "production" or "sandbox"');
    }

    const isProd = config.environment === 'production';
    if (config?.apiKey === '') {
      throw stacklessError('MNEE API key cannot be an empty string');
    }
    if (config?.apiKey) {
      this.mneeApiKey = config.apiKey;
    } else {
      this.mneeApiKey = isProd ? PUBLIC_PROD_MNEE_API_TOKEN : PUBLIC_SANDBOX_MNEE_API_TOKEN;
    }
    this.mneeApi = isProd ? MNEE_PROXY_API_URL : SANDBOX_MNEE_API_URL;
    this.configReady = this.getCosignerConfig();
    // Prevent an unhandled-rejection crash if the initial fetch fails before
    // it is awaited (e.g. when the caller replaces configReady via refreshConfig()).
    this.configReady.catch(() => {});
  }

  public async getCosignerConfig(): Promise<MNEEConfig> {
    try {
      const response = await fetch(`${this.mneeApi}/v1/config?auth_token=${this.mneeApiKey}`, { method: 'GET' });

      if (response.status === 401 || response.status === 403) {
        throw stacklessError('Invalid API key');
      }

      if (!response.ok) throw stacklessError(`HTTP error! status: ${response.status}`);
      const data: MNEEConfig = await response.json();
      this.mneeConfig = data;
      return data;
    } catch (error) {
      if (isNetworkError(error)) {
        logNetworkError(error, 'fetch config');
      }
      throw error;
    }
  }

  private async getConfig(): Promise<MNEEConfig> {
    if (this.mneeConfig) return this.mneeConfig;
    const currentPromise = this.configReady;
    try {
      return await currentPromise;
    } catch (err) {
      if (this.configReady === currentPromise) {
        this.configReady = this.getCosignerConfig();
        this.configReady.catch(() => {});
      }
      throw err;
    }
  }

  public async refreshConfig(): Promise<MNEEConfig> {
    // Fetch first — if it fails, the existing cached config is preserved
    // and the SDK remains operational (no state is mutated on error).
    const newConfig = await this.getCosignerConfig();
    this.mneeConfig = newConfig;
    this.configReady = Promise.resolve(newConfig);
    return newConfig;
  }

  /**
   * Look up the fee for a given atomic token amount from the fee tiers in config.
   * Returns undefined if no tier covers the amount.
   */
  private lookupFee(atomicAmount: number, fees: MNEEFee[]): number | undefined {
    return fees.find((f) => atomicAmount >= f.min && atomicAmount <= f.max)?.fee;
  }

  /**
   * Filter a UTXO array to only those with spendable op-codes (transfer / deploy+mint).
   * Extracted from getUtxos() where the same Set + filter appeared twice.
   */
  private static readonly VALID_UTXO_OPS = new Set(['transfer', 'deploy+mint']);

  private filterValidUtxos(data: MNEEUtxo[]): MNEEUtxo[] {
    return data.filter((utxo) =>
      MNEEService.VALID_UTXO_OPS.has(utxo.data.bsv21.op.toLowerCase()),
    );
  }

  /**
   * Validate and append an OP_RETURN output carrying arbitrary user data.
   * Extracted from transfer() and transferMulti() where the identical block appeared twice.
   */
  private addExtraDataOutput(tx: Transaction, extraData: NonNullable<TransferOptions['extraData']>): void {
    const items = Array.isArray(extraData) ? extraData : [extraData];

    if (items.length === 0) {
      throw stacklessError('extraData must contain at least one item');
    }

    const buffers: Buffer[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (!item || typeof item.data !== 'string') {
        throw stacklessError(`Invalid extraData at index ${i}: data must be a string`);
      }

      if (item.type === 'utf8') {
        const buf = Buffer.from(item.data, 'utf8');
        if (buf.length === 0) {
          throw stacklessError(`extraData at index ${i} is empty after UTF-8 encoding`);
        }
        buffers.push(buf);
      } else if (item.type === 'hex') {
        const hex = item.data.trim();
        if (!hex) {
          throw stacklessError(`extraData at index ${i} is empty`);
        }
        if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) {
          throw stacklessError(
            `extraData at index ${i} is not valid hex or has odd length: "${hex}"`,
          );
        }
        const buf = Buffer.from(hex, 'hex');
        if (buf.length === 0) {
          throw stacklessError(`extraData at index ${i} decoded to an empty buffer`);
        }
        buffers.push(buf);
      } else {
        throw stacklessError(`Unsupported extraData type at index ${i}: ${(item as any).type}`);
      }
    }

    const totalBytes = buffers.reduce((sum, b) => sum + b.length, 0);
    if (totalBytes > 512) {
      throw stacklessError(
        `extraData is too large: ${totalBytes} bytes (max allowed is 512 bytes)`,
      );
    }

    const script = new Script();
    script.writeOpCode(OP.OP_0);
    script.writeOpCode(OP.OP_RETURN);
    for (const buf of buffers) {
      script.writeBin(Array.from(buf));
    }
    tx.addOutput({
      satoshis: 0,
      lockingScript: LockingScript.fromBinary(script.toBinary()),
    });
  }

  public toAtomicAmount(amount: number): number {
    return Math.round(amount * 10 ** MNEE_DECIMALS);
  }

  public fromAtomicAmount(amount: number): number {
    return amount / 10 ** MNEE_DECIMALS;
  }

  public async createInscription(recipient: string, amount: number, config: MNEEConfig) {
    const inscriptionData = {
      p: 'bsv-20',
      op: 'transfer',
      id: config.tokenId,
      amt: amount.toString(),
    };
    return {
      lockingScript: applyInscription(new CosignTemplate().lock(recipient, PublicKey.fromString(config.approver)), {
        dataB64: Buffer.from(JSON.stringify(inscriptionData)).toString('base64'),
        contentType: 'application/bsv-20',
      }),
      satoshis: 1,
    };
  }

  public async getUtxos(
    address: string | string[],
    page?: number,
    size?: number,
    order?: 'asc' | 'desc',
  ): Promise<MNEEUtxo[]> {
    try {
      if (!address) {
        throw stacklessError('Address is required');
      }
      if (page !== undefined) {
        if (typeof page !== 'number' || page <= 0 || !Number.isFinite(page)) {
          throw stacklessError(`Invalid page: ${page}. Must be a positive integer`);
        }
      }

      if (size !== undefined) {
        if (typeof size !== 'number' || size <= 0 || !Number.isInteger(size)) {
          throw stacklessError(`Invalid size: ${size}. Must be a positive integer`);
        }
      }

      if (order !== undefined) {
        if (order !== 'asc' && order !== 'desc') {
          throw stacklessError(`Invalid order: ${order}. Must be 'asc' or 'desc'`);
        }
      }

      // Handle single address
      if (typeof address === 'string') {
        if (!validateAddress(address)) {
          throw stacklessError(`Invalid Bitcoin address: ${address}`);
        }
        const arrayAddress = [address];
        const response = await fetch(
          `${this.mneeApi}/v2/utxos?auth_token=${this.mneeApiKey}${page !== undefined ? `&page=${page}` : ''}${
            size !== undefined ? `&size=${size}` : ''
          }${order ? `&order=${order}` : ''}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(arrayAddress),
          },
        );
        if (response.status === 401 || response.status === 403) {
          throw stacklessError('Invalid API key');
        }
        if (!response.ok) throw stacklessError(`HTTP error! status: ${response.status}`);
        const data: MNEEUtxo[] = await response.json();
        return this.filterValidUtxos(data);
      }

      // Handle array of addresses - filter out invalid ones
      if (Array.isArray(address)) {
        const validAddresses = address.filter((addr) => typeof addr === 'string' && validateAddress(addr));

        if (validAddresses.length === 0) {
          throw stacklessError('No valid Bitcoin addresses provided');
        }

        // Log warning about invalid addresses
        const invalidAddresses = address.filter((addr) => typeof addr !== 'string' || !validateAddress(addr));
        if (invalidAddresses.length > 0) {
          console.warn(`\x1b[33m${invalidAddresses.length} invalid bitcoin addresses will be ignored\x1b[0m`);
        }

        const response = await fetch(
          `${this.mneeApi}/v2/utxos?auth_token=${this.mneeApiKey}${page !== undefined ? `&page=${page}` : ''}${
            size !== undefined ? `&size=${size}` : ''
          }${order ? `&order=${order}` : ''}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validAddresses),
          },
        );
        if (response.status === 401 || response.status === 403) {
          throw stacklessError('Invalid API key');
        }
        if (!response.ok) throw stacklessError(`HTTP error! status: ${response.status}`);
        const data: MNEEUtxo[] = await response.json();
        return this.filterValidUtxos(data);
      }

      throw stacklessError('Invalid input type for address');
    } catch (error) {
      if (isNetworkError(error)) {
        logNetworkError(error, 'fetch UTXOs');
      }
      throw error;
    }
  }

  public async fetchRawTx(txid: string, retries: number = 3): Promise<Transaction | undefined> {
    const cached = this.txFetchCache.get(txid);
    if (cached) return cached;
    const promise = this._doFetchRawTx(txid, retries);
    if (this.txFetchCache.size >= MNEEService.TX_CACHE_MAX) {
      const firstKey = this.txFetchCache.keys().next().value!;
      this.txFetchCache.delete(firstKey);
    }
    this.txFetchCache.set(txid, promise);
    promise.catch(() => this.txFetchCache.delete(txid));
    return promise;
  }

  private async _doFetchRawTx(txid: string, retries: number): Promise<Transaction | undefined> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const resp = await fetch(`${this.mneeApi}/v1/tx/${txid}?auth_token=${this.mneeApiKey}`);

        if (resp.status === 404) throw stacklessError('Transaction not found');
        if (resp.status === 401 || resp.status === 403) {
          throw stacklessError('Invalid API key');
        }

        // Handle rate limiting with retry
        if (resp.status === 429 && attempt < retries) {
          // For rate limiting, use longer delay with exponential backoff
          const delay = Math.min(500 * Math.pow(2, attempt), 2000); // 500ms, 1s, 2s max
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        if (resp.status !== 200) {
          throw stacklessError(`${resp.status} - Failed to fetch rawtx for txid: ${txid}`);
        }

        const { rawtx } = await resp.json();
        return Transaction.fromHex(Buffer.from(rawtx, 'base64').toString('hex'));
      } catch (error) {
        // Permanent errors — re-throw immediately, retrying won't help
        const msg = (error as Error)?.message ?? '';
        if (msg === 'Transaction not found' || msg === 'Invalid API key') {
          throw error;
        }
        if (attempt === retries) {
          if (isNetworkError(error)) {
            logNetworkError(error, 'fetch transaction');
          }
          return undefined;
        }
        // For transient errors, use a shorter fixed delay before retrying
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
    return undefined;
  }

  public async getSignatures(
    request: GetSignatures,
    privateKey: PrivateKey,
  ): Promise<{
    sigResponses?: SignatureResponse[];
    error?: { message: string; cause?: any };
  }> {
    try {
      const DEFAULT_SIGHASH_TYPE = 65;
      let tx: Transaction;
      switch (request.format) {
        case 'beef':
          tx = Transaction.fromHexBEEF(request.rawtx);
          break;
        case 'ef':
          tx = Transaction.fromHexEF(request.rawtx);
          break;
        default:
          tx = Transaction.fromHex(request.rawtx);
          break;
      }
      const sigResponses: SignatureResponse[] = request.sigRequests.flatMap((sigReq: SignatureRequest) => {
        return [privateKey].map((privKey: PrivateKey) => {
          const preimage = TransactionSignature.format({
            sourceTXID: sigReq.prevTxid,
            sourceOutputIndex: sigReq.outputIndex,
            sourceSatoshis: sigReq.satoshis,
            transactionVersion: tx.version,
            otherInputs: tx.inputs.filter((_, index) => index !== sigReq.inputIndex),
            inputIndex: sigReq.inputIndex,
            outputs: tx.outputs,
            inputSequence: tx.inputs[sigReq.inputIndex].sequence || 0,
            subscript: sigReq.script
              ? Script.fromHex(sigReq.script)
              : new P2PKH().lock(privKey.toPublicKey().toAddress()),
            lockTime: tx.lockTime,
            scope: sigReq.sigHashType || DEFAULT_SIGHASH_TYPE,
          });
          const rawSignature = privKey.sign(Hash.sha256(preimage));
          const sig = new TransactionSignature(
            rawSignature.r,
            rawSignature.s,
            sigReq.sigHashType || DEFAULT_SIGHASH_TYPE,
          );
          return {
            sig: Utils.toHex(sig.toChecksigFormat()),
            pubKey: privKey.toPublicKey().toString(),
            inputIndex: sigReq.inputIndex,
            sigHashType: sigReq.sigHashType || DEFAULT_SIGHASH_TYPE,
            csIdx: sigReq.csIdx,
          };
        });
      });
      return Promise.resolve({ sigResponses });
    } catch (err: any) {
      if (isNetworkError(err)) {
        logNetworkError(err, 'get signatures');
      }
      return {
        error: {
          message: err.message ?? 'unknown',
          cause: err.cause,
        },
      };
    }
  }

  private evictExpiredOutpoints(): void {
    const cutoff = Date.now() - MNEEService.OUTPOINT_LOCK_TTL;
    for (const [key, ts] of this.usedOutpoints) {
      if (ts < cutoff) this.usedOutpoints.delete(key);
    }
  }

  private extractLockedOutpoint(err: unknown): string | null {
    const msg = (err as { message?: unknown })?.message;
    if (typeof msg !== 'string') return null;
    const m = msg.match(/outpoint ([0-9a-fA-F]{64})_(\d+) was locked/);
    return m ? `${m[1]}_${m[2]}` : null;
  }

  public async getEnoughUtxos(address: string, totalAtomicTokenAmount: number): Promise<MNEEUtxo[]> {
    this.evictExpiredOutpoints();

    const config = await this.getConfig();
    if (!config) throw stacklessError('Config not fetched');
    const feeAmount = this.lookupFee(totalAtomicTokenAmount, config.fees);
    if (feeAmount === undefined) throw stacklessError('Fee not found');
    const requiredAmount = totalAtomicTokenAmount + feeAmount;

    const balance = await this.getBalance(address);
    if (balance.amount < requiredAmount) {
      const maxTransferAmount = this.fromAtomicAmount(balance.amount - feeAmount);
      throw stacklessError(`Insufficient MNEE balance. Max transfer amount: ${maxTransferAmount}`);
    }

    let page = 1;
    let size = 25;
    let allUtxos: MNEEUtxo[] = [];
    let totalUtxoAmount = 0;

    // Collect UTXOs until we have enough, skipping recently-used outpoints
    while (totalUtxoAmount < requiredAmount) {
      const pageUtxos = await this.getUtxos(address, page, size);
      const available = pageUtxos.filter((u) => !this.usedOutpoints.has(`${u.txid}_${u.vout}`));
      if (pageUtxos.length === 0) {
        if (this.usedOutpoints.size > 0) {
          throw stacklessError('UTXOs temporarily locked by recent transactions, retry shortly');
        }
        // This shouldn't happen given we checked balance, but handle gracefully
        const maxTransferAmount = this.fromAtomicAmount(totalUtxoAmount - feeAmount);
        throw stacklessError(`Insufficient MNEE balance. Max transfer amount: ${maxTransferAmount}`);
      }

      allUtxos.push(...available);
      totalUtxoAmount = allUtxos.reduce((sum, utxo) => sum + utxo.data.bsv21.amt, 0);

      if (totalUtxoAmount >= requiredAmount) {
        break;
      }

      if (pageUtxos.length < size) {
        if (this.usedOutpoints.size > 0) {
          throw stacklessError('UTXOs temporarily locked by recent transactions, retry shortly');
        }
        // No more pages — can't satisfy with available UTXOs
        const maxTransferAmount = this.fromAtomicAmount(totalUtxoAmount - feeAmount);
        throw stacklessError(`Insufficient MNEE balance. Max transfer amount: ${maxTransferAmount}`);
      }

      page++;
    }

    // Sort all collected UTXOs by amount (highest first) for optimal selection
    allUtxos.sort((a, b) => b.data.bsv21.amt - a.data.bsv21.amt);

    // Select only the UTXOs we need
    let selectedUtxos: MNEEUtxo[] = [];
    let selectedAmount = 0;

    for (const utxo of allUtxos) {
      selectedUtxos.push(utxo);
      selectedAmount += utxo.data.bsv21.amt;
      if (selectedAmount >= requiredAmount) {
        break;
      }
    }

    return selectedUtxos;
  }

  public async getAllUtxos(address: string): Promise<MNEEUtxo[]> {
    const PAGE_SIZE = 100;
    const WINDOW = 4;
    let page = 1;
    const utxos: MNEEUtxo[] = [];

    while (true) {
      const pageNums = Array.from({ length: WINDOW }, (_, i) => page + i);
      const pages = await Promise.all(pageNums.map((p) => this.getUtxos(address, p, PAGE_SIZE)));

      let done = false;
      for (const pageResults of pages) {
        utxos.push(...pageResults);
        if (pageResults.length < PAGE_SIZE) {
          done = true;
          break;
        }
      }

      if (done) break;
      page += WINDOW;
    }

    return utxos;
  }

  public async transfer(
    request: SendMNEE[],
    wif: string,
    transferOptions?: TransferOptions,
  ): Promise<TransferResponse> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= MNEEService.LOCK_RETRY_MAX; attempt++) {
      try {
        return await this.transferAttempt(request, wif, transferOptions);
      } catch (err) {
        lastErr = err;
        const locked = this.extractLockedOutpoint(err);
        if (!locked || attempt === MNEEService.LOCK_RETRY_MAX) {
          throw err;
        }
        this.usedOutpoints.set(locked, Date.now());
        await new Promise((r) => setTimeout(r, MNEEService.LOCK_RETRY_BACKOFF_MS));
      }
    }
    throw lastErr;
  }

  private async transferAttempt(
    request: SendMNEE[],
    wif: string,
    transferOptions?: TransferOptions,
  ): Promise<TransferResponse> {
    try {
      const config = await this.getConfig();
      if (!config) throw stacklessError('Config not fetched');

      const { isValid, totalAmount, privateKey, error } = validateTransferOptions(request, wif);
      if (!isValid) throw stacklessError(error || 'Invalid transfer options');
      if (!privateKey) throw stacklessError('Private key not found');
      if (!totalAmount) throw stacklessError('Invalid amount');

      const totalAtomicTokenAmount = this.toAtomicAmount(totalAmount);

      const address = privateKey.toAddress();
      const utxos = await this.getEnoughUtxos(address, totalAtomicTokenAmount);

      // Note: burn-address fee exemption was removed in MN-122; fee is always looked up from tiers.
      const fee = this.lookupFee(totalAtomicTokenAmount, config.fees);
      if (fee === undefined) throw stacklessError('Fee ranges inadequate');

      const tx = new Transaction(1, [], [], 0);
      let tokensIn = 0;
      let changeAddress = '';

      while (tokensIn < totalAtomicTokenAmount + fee) {
        const utxo = utxos.shift();
        if (!utxo) {
          const balance = await this.getBalance(address);
          const maxTransferAmount = this.fromAtomicAmount(balance.amount - fee);
          throw stacklessError('Insufficient MNEE balance. Max transfer amount is ' + maxTransferAmount);
        }

        const sourceTransaction = await this.fetchRawTx(utxo.txid);
        if (!sourceTransaction) throw stacklessError(`Failed to fetch source transaction: ${utxo.txid}_${utxo.vout}`);

        changeAddress = changeAddress || utxo.owners[0];
        tx.addInput({
          sourceTXID: utxo.txid,
          sourceOutputIndex: utxo.vout,
          sourceTransaction,
          unlockingScript: new UnlockingScript(),
        });
        tokensIn += utxo.data.bsv21.amt;
      }

      for (const req of request) {
        tx.addOutput(await this.createInscription(req.address, this.toAtomicAmount(req.amount), config));
      }
      if (fee > 0) tx.addOutput(await this.createInscription(config.feeAddress, fee, config));

      const change = tokensIn - totalAtomicTokenAmount - fee;
      if (change > 0) {
        tx.addOutput(await this.createInscription(changeAddress, change, config));
      }
      if (transferOptions?.extraData) {
        this.addExtraDataOutput(tx, transferOptions.extraData);
      }

      const privateKeys = new Map<number, PrivateKey>();
      for (let i = 0; i < tx.inputs.length; i++) {
        privateKeys.set(i, privateKey);
      }

      const signResult = await this.signAllInputs(tx, privateKeys);
      if (signResult.error) throw stacklessError(signResult.error);

      const rawtx = tx.toHex();

      if (transferOptions?.broadcast === false) {
        return { rawtx };
      }

      const now = Date.now();
      for (const input of tx.inputs) {
        this.usedOutpoints.set(`${input.sourceTXID}_${input.sourceOutputIndex}`, now);
      }
      const { ticketId } = await this.submitRawTx(rawtx, transferOptions);
      if (!ticketId) throw stacklessError('Failed to broadcast transaction');
      return { ticketId };
    } catch (error) {
      if (isNetworkError(error)) {
        logNetworkError(error, 'transfer tokens');
      }
      throw error;
    }
  }

  public async submitRawTx(
    rawtx: string,
    transferOptions: TransferOptions = { broadcast: true, callbackUrl: undefined },
  ): Promise<TransferResponse> {
    try {
      if (transferOptions?.broadcast !== false) {
        transferOptions = { ...transferOptions, broadcast: true };
      }
      if (transferOptions?.callbackUrl && transferOptions?.broadcast === false) {
        throw stacklessError('Callback URL cannot be provided when broadcast is false');
      }
      if (!rawtx) {
        throw stacklessError('Raw transaction is required');
      }

      // Convert to base64 format for V2 API
      const tx = Transaction.fromHex(rawtx);
      if (!transferOptions?.broadcast) {
        return { rawtx: tx.toHex() };
      }
      const base64Tx = Utils.toBase64(tx.toBinary());

      const requestBody = JSON.stringify(
        transferOptions ? { rawtx: base64Tx, callback_url: transferOptions.callbackUrl } : { rawtx: base64Tx },
      );

      // Submit to V2 transfer endpoint for async processing
      const response = await fetch(`${this.mneeApi}/v2/transfer?auth_token=${this.mneeApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        const lockMatch = body.match(/outpoint ([0-9a-fA-F]{64})_(\d+) was locked/);
        if (lockMatch) {
          this.usedOutpoints.set(`${lockMatch[1]}_${lockMatch[2]}`, Date.now());
        }
        throw stacklessError(`Failed to submit transaction: ${body}`);
      }

      const ticketId = await response.text();

      return { ticketId };
    } catch (error) {
      if (isNetworkError(error)) {
        logNetworkError(error, 'submit raw transaction');
      }
      throw error;
    }
  }

  public async getTxStatus(ticketId: string): Promise<TransferStatus> {
    try {
      if (!ticketId) {
        throw stacklessError('Ticket ID is required');
      }

      const response = await fetch(`${this.mneeApi}/v2/ticket?ticketID=${ticketId}&auth_token=${this.mneeApiKey}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw stacklessError(`Failed to get transaction status`);
      }

      const status: TransferStatus = await response.json();
      return status;
    } catch (error) {
      if (isNetworkError(error)) {
        logNetworkError(error, 'get transaction status');
      }
      throw error;
    }
  }

  public async getBalance(address: string): Promise<MNEEBalance> {
    // Validate address before making any API calls
    if (!validateAddress(address)) {
      const error = stacklessError(`Invalid Bitcoin address: ${address}`);
      throw error;
    }

    try {
      const config = await this.getConfig();
      if (!config) throw stacklessError('Config not fetched');

      const response = await fetch(`${this.mneeApi}/v2/balance?auth_token=${this.mneeApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([address]),
      });

      if (!response.ok) {
        throw stacklessError(`Failed to get transaction status: ${response.status}`);
      }

      const balanceData: BalanceResponse = await response.json();

      // Handle empty array response (no balance for address)
      if (!balanceData || balanceData.length === 0) {
        return {
          address: address,
          amount: 0,
          decimalAmount: 0,
        };
      }

      return {
        address: balanceData[0].address,
        amount: balanceData[0].amt,
        decimalAmount: balanceData[0].precised,
      };
    } catch (error) {
      if (isNetworkError(error)) {
        logNetworkError(error, 'fetch balance');
      }
      throw error;
    }
  }

  public async getBalances(addresses: string[]): Promise<MNEEBalance[]> {
    if (!Array.isArray(addresses)) {
      throw stacklessError('Addresses must be an array');
    }
    const validAddresses = addresses.filter((addr) => validateAddress(addr));
    if (validAddresses.length === 0) {
      throw stacklessError('You must pass at least 1 valid address');
    }
    const totalInvalidAddresses = addresses.length - validAddresses.length;
    if (totalInvalidAddresses > 0) {
      console.warn(`\x1b[33m${totalInvalidAddresses} invalid bitcoin addresses will be ignored\x1b[0m`);
    }
    try {
      const config = await this.getConfig();
      if (!config) throw stacklessError('Config not fetched');
      const response = await fetch(`${this.mneeApi}/v2/balance?auth_token=${this.mneeApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validAddresses),
      });

      if (!response.ok) {
        throw stacklessError(`Failed to get transaction status: ${response.status}`);
      }

      const balanceData: BalanceResponse = await response.json();

      // If API returns empty array, return all addresses with 0 balance
      if (!balanceData || balanceData.length === 0) {
        return validAddresses.map((addr) => ({
          address: addr,
          amount: 0,
          decimalAmount: 0,
        }));
      }

      // Create a map of addresses that have balances
      const balanceMap = new Map();
      balanceData.forEach((balance) => {
        balanceMap.set(balance.address, {
          address: balance.address,
          amount: balance.amt,
          decimalAmount: balance.precised,
        });
      });

      // Return all requested addresses, with 0 for those not in response
      return validAddresses.map((addr) => {
        if (balanceMap.has(addr)) {
          return balanceMap.get(addr);
        }
        return {
          address: addr,
          amount: 0,
          decimalAmount: 0,
        };
      });
    } catch (error) {
      if (isNetworkError(error)) {
        logNetworkError(error, 'fetch balances');
      }
      throw error;
    }
  }

  private processMneeValidation(tx: Transaction, config: MNEEConfig, request?: SendMNEE[]) {
    try {
      const txid = tx.id('hex');
      const isDeployTx = txid === config.tokenId.split('_')[0];

      const scripts = tx.outputs.map((output) => output.lockingScript);
      const parsedScripts = parseCosignerScripts(scripts);

      // Build a map of all outputs with their inscriptions
      const outputDetails = tx.outputs.map((output, idx) => {
        const script = output.lockingScript;
        const parsed = parsedScripts[idx];
        const inscription = parseInscription(script);

        let inscriptionData = null;
        if (inscription?.file?.content) {
          try {
            const content = Utils.toUTF8(inscription.file.content);
            if (content) {
              inscriptionData = JSON.parse(content);
            }
          } catch (e) {
            // Not a valid JSON inscription, skip
          }
        }

        return {
          index: idx,
          address: parsed?.address,
          cosigner: parsed?.cosigner,
          inscription: inscriptionData,
        };
      });

      // Check for cosigner presence and validity
      const hasCosigner = outputDetails.some((o) => o.cosigner === config.approver);
      const invalidCosigner = outputDetails.find((o) => o.cosigner !== '' && o.cosigner !== config.approver);

      if (invalidCosigner) {
        throw stacklessError('Invalid cosigner detected');
      }

      // Get all valid MNEE inscriptions
      const mneeInscriptions = outputDetails.filter((output) => {
        if (!output.inscription) return false;

        const insc = output.inscription as MneeInscription;
        if (insc.p !== 'bsv-20') return false;

        // Check token ID (skip for deploy transactions)
        if (!isDeployTx && insc.id !== config.tokenId) {
          throw stacklessError(`Invalid token ID: ${insc.id}`);
        }

        // Validate amount
        const amt = parseInt(insc.amt, 10);
        if (isNaN(amt) || amt <= 0) {
          throw stacklessError(`Invalid MNEE amount: ${insc.amt}`);
        }

        return true;
      });

      if (mneeInscriptions.length === 0) {
        throw stacklessError('No valid MNEE inscriptions found in transaction');
      }

      // Check what operations we have
      const operations = new Set(mneeInscriptions.map((o) => (o.inscription as MneeInscription).op));
      const hasBurn = operations.has('burn');

      // Check for redeem operations (transfer with redeem metadata)
      const hasRedeem = mneeInscriptions.some(
        (o) =>
          (o.inscription as MneeInscription).op === 'transfer' &&
          (o.inscription as MneeInscription).metadata?.action === 'redeem',
      );

      // Check if this is a redeem from mint address (which doesn't require cosigner)
      const isRedeemFromMint =
        hasRedeem && outputDetails.some((o) => o.address === SANDBOX_MINT_ADDRESS || o.address === PROD_MINT_ADDRESS);

      // Check for regular transfers (not redeems)
      const hasRegularTransfer = operations.has('transfer') && !hasRedeem;

      // Require cosigner for regular transfers, burns, and non-mint redeems
      if ((hasRegularTransfer || hasBurn || (hasRedeem && !isRedeemFromMint)) && !hasCosigner) {
        throw stacklessError('Cosigner not found in transaction with transfer/burn/redeem operation');
      }

      const mneeOutputsForValidation = mneeInscriptions.filter((output) => {
        const insc = output.inscription as MneeInscription;
        return insc.op === 'transfer' || insc.op === 'burn' || insc.op === 'deploy+mint';
      });

      // If request is provided, validate it matches the transaction
      if (request) {
        // Ensure we have enough outputs for all requests (including duplicates)
        const remainingOutputs = [...mneeOutputsForValidation];
        for (const req of request) {
          const outputIndex = remainingOutputs.findIndex(
            (output) =>
              output.address === req.address &&
              (output.inscription as MneeInscription).amt === this.toAtomicAmount(req.amount).toString(),
          );

          if (outputIndex === -1) {
            throw stacklessError(`No matching output found for ${req.address} with amount ${req.amount}`);
          }

          // Remove the matched output so it can't be matched again
          remainingOutputs.splice(outputIndex, 1);
        }
      }

      return true;
    } catch (error) {
      if (isNetworkError(error)) {
        logNetworkError(error, 'validate Mnee transaction');
      }
      return false;
    }
  }

  public async validateMneeTx(rawTx: string, request?: SendMNEE[]) {
    try {
      const config = await this.getConfig();
      if (!config) throw stacklessError('Config not fetched');
      const tx = Transaction.fromHex(rawTx);
      const isValid = this.processMneeValidation(tx, config, request);

      if (!isValid) return false;

      const txid = tx.id('hex');
      const isDeployTx = txid === config.tokenId.split('_')[0];

      // For non-deploy transactions, validate input/output totals
      if (!isDeployTx) {
        const inputData = await this.processTransactionInputs(tx, config);
        const outputData = this.processTransactionOutputs(tx, config);

        if (inputData.total !== outputData.total) {
          return false;
        }
      }

      return true;
    } catch (error) {
      if (isNetworkError(error)) {
        logNetworkError(error, 'validate Mnee transaction');
      }
      return false;
    }
  }

  private async getMneeSyncs(
    addresses: string | string[],
    fromScore?: number,
    limit?: number,
    order?: 'asc' | 'desc',
  ): Promise<{ address: string; syncs: MneeSync[] }[]> {
    try {
      const addressArray = Array.isArray(addresses) ? addresses : [addresses];
      const response = await fetch(
        `${this.mneeApi}/v1/sync?auth_token=${this.mneeApiKey}${fromScore ? `&from=${fromScore}` : ''}${
          limit ? `&limit=${limit}` : ''
        }${order ? `&order=${order}` : ''}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(addressArray),
        },
      );
      if (response.status === 401 || response.status === 403) {
        throw stacklessError('Invalid API key');
      }
      if (!response.ok) throw stacklessError(`HTTP error! status: ${response.status}`);
      const data: MneeSync[] = await response.json();

      // Group syncs by address
      const syncsByAddress = addressArray.map((address) => {
        const filteredSyncs = data.filter((sync) => sync.senders.includes(address) || sync.receivers.includes(address));
        return { address, syncs: filteredSyncs };
      });

      return syncsByAddress;
    } catch (error) {
      if (isNetworkError(error)) {
        logNetworkError(error, 'fetch syncs');
      }
      throw error;
    }
  }

  public async getRecentTxHistory(
    address: string,
    fromScore?: number,
    limit?: number,
    order?: 'asc' | 'desc',
  ): Promise<TxHistoryResponse> {
    if (!validateAddress(address)) {
      const error = stacklessError(`Invalid Bitcoin address: ${address}`);
      throw error;
    }

    if (fromScore !== undefined) {
      if (typeof fromScore !== 'number' || fromScore < 0 || !Number.isFinite(fromScore)) {
        throw stacklessError(`Invalid fromScore: ${fromScore}. Must be a positive number or 0`);
      }
    }

    if (limit !== undefined) {
      if (typeof limit !== 'number' || limit <= 0 || !Number.isInteger(limit)) {
        throw stacklessError(`Invalid limit: ${limit}. Must be a positive integer`);
      }
    }

    if (order !== undefined) {
      if (order !== 'asc' && order !== 'desc') {
        throw stacklessError(`Invalid order: ${order}. Must be 'asc' or 'desc'`);
      }
    }

    try {
      const config = await this.getConfig();
      if (!config) throw stacklessError('Config not fetched');

      const syncsByAddress = await this.getMneeSyncs(address, fromScore, limit, order);
      const { syncs } = syncsByAddress[0]; // We're only requesting one address

      if (!syncs || syncs.length === 0) return { address, history: [], nextScore: fromScore || 0 };

      const txHistory: TxHistory[] = [];
      for (const sync of syncs) {
        const historyItem = parseSyncToTxHistory(sync, address, config);
        if (historyItem) {
          txHistory.push(historyItem);
        }
      }

      const nextScore = txHistory.length > 0 ? txHistory[txHistory.length - 1].score : fromScore || 0;

      if (limit && txHistory.length > limit) {
        return {
          address,
          history: txHistory.slice(0, limit),
          nextScore,
        };
      }

      return {
        address,
        history: txHistory,
        nextScore,
      };
    } catch (error) {
      if (isNetworkError(error)) {
        logNetworkError(error, 'fetch transaction history');
      }
      throw error;
    }
  }

  public async getRecentTxHistories(params: AddressHistoryParams[]): Promise<TxHistoryResponse[]> {
    if (!Array.isArray(params)) {
      throw stacklessError('Parameters must be an array');
    }

    if (params.length === 0) {
      throw stacklessError('You must pass at least 1 address parameter');
    }

    // Filter out invalid addresses and keep only valid ones
    const validParams = params.filter((param) => param && param.address && validateAddress(param.address));

    if (validParams.length === 0) {
      throw stacklessError('You must pass at least 1 valid address');
    }

    const totalInvalidAddresses = params.length - validParams.length;
    if (totalInvalidAddresses > 0) {
      console.warn(`\x1b[33m${totalInvalidAddresses} invalid bitcoin addresses will be ignored\x1b[0m`);
    }

    for (const param of validParams) {
      if (param.fromScore !== undefined) {
        if (typeof param.fromScore !== 'number' || param.fromScore < 0 || !Number.isFinite(param.fromScore)) {
          throw stacklessError(
            `Invalid fromScore for address ${param.address}: ${param.fromScore}. Must be a positive number or 0`,
          );
        }
      }

      if (param.limit !== undefined) {
        if (typeof param.limit !== 'number' || param.limit <= 0 || !Number.isInteger(param.limit)) {
          throw stacklessError(
            `Invalid limit for address ${param.address}: ${param.limit}. Must be a positive integer`,
          );
        }
      }

      if (param.order !== undefined) {
        if (param.order !== 'asc' && param.order !== 'desc') {
          throw stacklessError(`Invalid order for address ${param.address}: ${param.order}. Must be 'asc' or 'desc'`);
        }
      }
    }

    try {
      const config = await this.getConfig();
      if (!config) throw stacklessError('Config not fetched');

      // Group addressParams by fromScore, limit, and order to batch requests efficiently
      const groupedParams: Record<string, AddressHistoryParams[]> = {};
      validParams.forEach((param) => {
        const key = `${param.fromScore || 0}:${param.limit || 100}:${param.order || 'default'}`;
        if (!groupedParams[key]) {
          groupedParams[key] = [];
        }
        groupedParams[key].push(param);
      });

      // Process each group in parallel
      const groupPromises = Object.entries(groupedParams).map(async ([key, addressParams]) => {
        const [fromScoreStr, limitStr, orderStr] = key.split(':');
        const fromScore = Number(fromScoreStr);
        const limit = Number(limitStr);
        const order = orderStr === 'default' ? undefined : (orderStr as 'asc' | 'desc');
        const addresses = addressParams.map((p) => p.address);

        const syncsByAddress = await this.getMneeSyncs(addresses, fromScore, limit, order);

        // Process each address's syncs
        return syncsByAddress.map(({ address, syncs }) => {
          const param = addressParams.find((p) => p.address === address);
          if (!syncs || syncs.length === 0) {
            return {
              address,
              history: [],
              nextScore: param?.fromScore || 0,
            };
          }

          const txHistory: TxHistory[] = [];
          const seenTxids = new Set<string>();

          for (const sync of syncs) {
            const historyItem = parseSyncToTxHistory(sync, address, config);
            if (historyItem && !seenTxids.has(historyItem.txid)) {
              seenTxids.add(historyItem.txid);
              txHistory.push(historyItem);
            }
          }

          const nextScore = txHistory.length > 0 ? txHistory[txHistory.length - 1].score : param?.fromScore || 0;
          const paramLimit = param?.limit;

          if (paramLimit && txHistory.length > paramLimit) {
            return {
              address,
              history: txHistory.slice(0, paramLimit),
              nextScore,
            };
          }

          return {
            address,
            history: txHistory,
            nextScore,
          };
        });
      });

      // Flatten the results
      const results = await Promise.all(groupPromises);
      return results.flat();
    } catch (error) {
      if (isNetworkError(error)) {
        logNetworkError(error, 'fetch transaction histories');
      }
      throw error;
    }
  }

  // ============================================
  // parseTransaction HELPERS
  // ============================================

  /**
   * Parses inscription data from a script
   * @param script The script to parse
   * @returns The parsed inscription data or null if invalid
   */
  private parseInscriptionData(script: Script): MneeInscription | null {
    try {
      const inscription = parseInscription(script);
      const content = inscription?.file?.content;
      if (!content) return null;

      const inscriptionData = Utils.toUTF8(content);
      if (!inscriptionData) return null;

      return JSON.parse(inscriptionData) as MneeInscription;
    } catch (error) {
      if (isNetworkError(error)) {
        logNetworkError(error, 'parse inscription data');
      }
      return null;
    }
  }

  private determineEnvironment(txid: string, tokenId: string, cosigner: string, address: string): Environment {
    // Highest priority: specific transaction IDs
    if (txid === PROD_TOKEN_ID.split('_')[0]) return 'production'; // genesis (deploy) transaction
    if (txid === SANDBOX_TOKEN_ID.split('_')[0]) return 'sandbox'; // genesis (deploy) transaction

    // Production if BOTH token and approver match
    if (tokenId === PROD_TOKEN_ID && cosigner === PROD_APPROVER) {
      return 'production';
    }

    // Sandbox if BOTH token and approver match
    if (tokenId === SANDBOX_TOKEN_ID && cosigner === SANDBOX_APPROVER) {
      return 'sandbox';
    }

    // Special case: empty cosigner with production address (mint operations)
    if (cosigner === '' && address === PROD_MINT_ADDRESS) {
      return 'production';
    }

    // Special case: empty cosigner with sandbox address (mint operations)
    if (cosigner === '' && address === SANDBOX_MINT_ADDRESS) {
      return 'sandbox';
    }

    // Default to sandbox for all other cases
    return 'sandbox';
  }

  private determineTransactionType(
    operation: string,
    address: string,
    txid: string,
    mintAddress: string,
    tokenId: string,
  ): TxOperation {
    // Highest priority: burn operation
    if (operation === 'burn') return 'burn';

    // Deploy+mint operation
    if (operation === 'deploy+mint' || address === mintAddress) {
      // If txid matches the token ID prefix, it's a deploy
      return txid === tokenId.split('_')[0] ? 'deploy' : 'mint';
    }

    // Known addresses indicate mint
    if (address === PROD_MINT_ADDRESS || address === SANDBOX_MINT_ADDRESS) {
      return 'mint';
    }

    // Default to transfer
    return 'transfer';
  }

  private async processTransactionInputs(
    tx: Transaction,
    config: MNEEConfig,
    opts?: { noNetwork?: boolean },
  ): Promise<TxInputResponse> {
    const txid = tx.id('hex');
    const inputs: ProcessedInput[] = new Array(tx.inputs.length);
    let total = BigInt(0);
    let environment: Environment | undefined;
    let type: TxOperation | undefined;

    const fetchTasks = tx.inputs.map(async (input, index) => {
      if (!input.sourceTXID) {
        return { index, sourceTx: null };
      }

      // Use embedded source transaction if available (e.g. parsed from BEEF/EF format) — no network call needed
      if (input.sourceTransaction) {
        return { index, sourceTx: input.sourceTransaction };
      }

      // BEEF parsing path: never fetch from network. Missing parents become unknown inputs.
      // The MNEE API doesn't serve non-MNEE BSV transactions (e.g. plain fee inputs) or oversized
      // MNEE distribution txs, so a "complete" BEEF often isn't constructible — that's expected.
      if (opts?.noNetwork) {
        return { index, sourceTx: null };
      }

      try {
        const sourceTx = await this.inputFetchLimiter.execute(() => this.fetchRawTx(input.sourceTXID!));
        return { index, sourceTx };
      } catch (error) {
        if (isNetworkError(error)) {
          logNetworkError(error, 'fetch source transaction');
        }
        return { index, sourceTx: null };
      }
    });

    const results = await Promise.all(fetchTasks);

    for (const { index, sourceTx } of results) {
      const input = tx.inputs[index];
      if (!sourceTx || !input.sourceTXID) {
        inputs[index] = {
          address: undefined,
          amount: 0,
          satoshis: 0,
          inscription: null,
          cosigner: undefined,
        };
        continue;
      }

      const sourceOutput = sourceTx.outputs[input.sourceOutputIndex];
      const parsedCosigner = parseCosignerScripts([sourceOutput.lockingScript])[0];
      const inscription = this.parseInscriptionData(sourceOutput.lockingScript);

      const processedInput: ProcessedInput = {
        address: parsedCosigner?.address,
        amount: inscription ? parseInt(inscription.amt) : 0,
        satoshis: Number(sourceOutput.satoshis),
        inscription,
        cosigner: parsedCosigner,
      };

      inputs[index] = processedInput;

      if (inscription && parsedCosigner) {
        total += BigInt(inscription.amt);

        // Determine environment if not already set
        if (!environment) {
          environment = this.determineEnvironment(
            txid,
            inscription.id,
            parsedCosigner.cosigner || '',
            parsedCosigner.address || '',
          );
        }

        // Determine type if not already set
        if (!type) {
          type = this.determineTransactionType(
            inscription.op,
            parsedCosigner.address || '',
            txid,
            config.mintAddress,
            config.tokenId,
          );
        }
      }
    }

    return { inputs, total, environment, type };
  }

  private processTransactionOutputs(tx: Transaction, config: MNEEConfig): TxOutputResponse {
    const txid = tx.id('hex');
    const outputs: ProcessedOutput[] = [];
    let total = BigInt(0);
    let environment: Environment | undefined;
    let type: TxOperation | undefined;

    for (let i = 0; i < tx.outputs.length; i++) {
      const output = tx.outputs[i];

      const parsedCosigner = parseCosignerScripts([output.lockingScript])[0];
      const inscription = this.parseInscriptionData(output.lockingScript);

      const processedOutput: ProcessedOutput = {
        address: parsedCosigner?.address,
        amount: inscription ? parseInt(inscription.amt) : 0,
        satoshis: Number(output.satoshis),
        inscription,
        cosigner: parsedCosigner,
      };

      outputs.push(processedOutput);

      if (inscription && parsedCosigner) {
        total += BigInt(inscription.amt);

        environment = this.determineEnvironment(
          txid,
          inscription.id,
          parsedCosigner.cosigner || '',
          parsedCosigner.address || '',
        );

        const outputType = this.determineTransactionType(
          inscription.op,
          parsedCosigner.address || '',
          txid,
          config.mintAddress,
          config.tokenId,
        );

        if (outputType === 'burn' || outputType === 'deploy') {
          type = outputType;
        } else if (!type) {
          type = outputType;
        }
      }
    }

    return { outputs, total, environment, type };
  }

  private validateTransaction(
    config: MNEEConfig,
    tx: Transaction,
    type: TxOperation,
    inputTotal: bigint,
    outputTotal: bigint,
  ): boolean {
    const isValidMnee = this.processMneeValidation(tx, config);
    if (!isValidMnee) return false;
    if (type === 'deploy') return true;
    // Redeem transactions follow the same balance rules as transfers
    return inputTotal === outputTotal;
  }

  private buildParseResponse(
    txid: string,
    environment: Environment,
    type: TxOperation,
    inputData: { inputs: ProcessedInput[]; total: bigint },
    outputData: { outputs: ProcessedOutput[]; total: bigint },
    isValid: boolean,
    tx: Transaction,
    options?: ParseOptions,
  ): ParseTxResponse | ParseTxExtendedResponse {
    const simpleInputs: TxAddressAmount[] = inputData.inputs
      .filter((input) => input.inscription && input.address)
      .map((input) => ({
        address: input.address!,
        amount: input.amount,
      }));

    const simpleOutputs: TxAddressAmount[] = outputData.outputs
      .filter((output) => output.inscription && output.address)
      .map((output) => ({
        address: output.address!,
        amount: output.amount,
      }));

    const baseResponse: ParseTxResponse = {
      txid,
      environment,
      type,
      inputs: simpleInputs,
      outputs: simpleOutputs,
      isValid,
      inputTotal: inputData.total.toString(),
      outputTotal: outputData.total.toString(),
    };

    if (options?.includeRaw) {
      const extendedResponse: ParseTxExtendedResponse = {
        ...baseResponse,
        raw: {
          txHex: tx.toHex(),
          inputs: tx.inputs.map((input, index) => {
            const processedInput = inputData.inputs[index];
            return {
              txid: input.sourceTXID || '',
              vout: input.sourceOutputIndex,
              scriptSig: input.unlockingScript?.toHex() || '',
              sequence: input.sequence || 0xffffffff,
              address: processedInput?.address,
              satoshis: processedInput?.satoshis || 0,
              tokenData: processedInput?.inscription ? { amount: processedInput.amount } : undefined,
            };
          }),
          outputs: tx.outputs.map((output, index) => {
            const processedOutput = outputData.outputs[index];
            return {
              value: Number(output.satoshis),
              scriptPubKey: output.lockingScript.toHex(),
              address: processedOutput?.address,
              tokenData: processedOutput?.inscription ? { amount: processedOutput.amount } : undefined,
            };
          }),
        },
      };
      return extendedResponse;
    }

    return baseResponse;
  }

  private async parseTransaction(
    tx: Transaction,
    config: MNEEConfig,
    options?: ParseOptions,
    internalOpts?: { noNetwork?: boolean },
  ): Promise<ParseTxResponse | ParseTxExtendedResponse> {
    const txid = tx.id('hex');

    const hasEmbeddedSources = tx.inputs.some((i) => i.sourceTransaction);
    const useFastPath = options?.skipInputFetch === true && !hasEmbeddedSources;

    const outputData = this.processTransactionOutputs(tx, config);

    let inputData: TxInputResponse;
    let type: TxOperation;
    let isValid: boolean;

    if (useFastPath) {
      const emptyInputs: ProcessedInput[] = tx.inputs.map(() => ({
        address: undefined,
        amount: 0,
        satoshis: 0,
        inscription: null,
        cosigner: undefined,
      }));
      inputData = { inputs: emptyInputs, total: BigInt(0) };

      // Output-only type determination: mint detection not possible without input sources
      type = outputData.type || 'transfer';

      // Redeem check is output-based, still valid in fast path
      if (type === 'transfer') {
        const hasRedeemOutput = outputData.outputs.some((output) => output.inscription?.metadata?.action === 'redeem');
        if (hasRedeemOutput) type = 'redeem';
      }

      // Script/cosigner/token-ID validation only — no token-conservation check
      isValid = this.processMneeValidation(tx, config);
    } else {
      inputData = await this.processTransactionInputs(tx, config, internalOpts);

      const environment = outputData.environment || inputData.environment || 'sandbox';
      type = outputData.type || inputData.type || 'transfer';

      if (type === 'transfer') {
        const hasMintInputAddress = inputData.inputs.some(
          (input) => input.inscription && (input.address === PROD_MINT_ADDRESS || input.address === SANDBOX_MINT_ADDRESS),
        );
        if (hasMintInputAddress) type = 'mint';
      }

      if (type === 'transfer' || type === 'mint') {
        const hasRedeemOutput = outputData.outputs.some((output) => output.inscription?.metadata?.action === 'redeem');
        if (hasRedeemOutput) type = 'redeem';
      }

      // If there are no inputs with inscriptions, it can be nothing but a deploy
      const inputsWithInscriptions = inputData.inputs.filter((input) => input.inscription);
      if (inputsWithInscriptions.length === 0 && inputData.inputs.length > 0) {
        type = 'deploy';
      }

      isValid = this.validateTransaction(config, tx, type, inputData.total, outputData.total);

      return this.buildParseResponse(txid, environment, type, inputData, outputData, isValid, tx, options);
    }

    const environment = outputData.environment || 'sandbox';
    return this.buildParseResponse(txid, environment, type, inputData, outputData, isValid, tx, options);
  }

  public async parseTx(txid: string, options?: ParseOptions): Promise<ParseTxResponse | ParseTxExtendedResponse> {
    const hexRegex = /^[a-fA-F0-9]{64}$/;
    if (!txid || typeof txid !== 'string' || txid.trim() === '' || !hexRegex.test(txid)) {
      throw stacklessError('A valid transaction ID is required');
    }

    const config = await this.getConfig();
    if (!config) throw stacklessError('Config not fetched');
    const tx = await this.fetchRawTx(txid);
    if (!tx) throw stacklessError('Failed to fetch transaction');
    return await this.parseTransaction(tx, config, options);
  }

  public async parseTxFromRawTx(
    rawTxHex: string,
    options?: ParseOptions,
  ): Promise<ParseTxResponse | ParseTxExtendedResponse> {
    if (!rawTxHex || typeof rawTxHex !== 'string' || rawTxHex.trim() === '') {
      throw stacklessError('A valid raw transaction is required');
    }
    if (!isValidHex(rawTxHex)) {
      throw stacklessError('Invalid raw transaction hex');
    }
    const tx = Transaction.fromHex(rawTxHex);
    const config = await this.getConfig();
    if (!config) throw stacklessError('Config not fetched');
    return await this.parseTransaction(tx, config, options);
  }

  /**
   * Parse a transaction from BEEF (Bitcoin Extended Format) hex — purely compute-based, no API calls.
   *
   * BEEF embeds parent transactions inline; embedded parents resolve locally with no network
   * lookup. Inputs whose parent is NOT embedded (e.g. plain BSV fee inputs the MNEE API doesn't
   * serve, or oversized MNEE distribution txs the indexer can't return) resolve as "unknown" —
   * address: undefined, amount/satoshis: 0 — rather than triggering a network fetch. This keeps
   * the call strictly compute-only and matches the lenient behaviour of parseTxFromRawTx when
   * a parent can't be obtained.
   *
   * Use `Transaction.toHexBEEF()` from @bsv/sdk to produce the BEEF hex after building a tx.
   *
   * @param beefHex - A BEEF-encoded transaction hex string
   * @param options - Optional parse options (e.g. includeRaw)
   */
  public async parseTxFromBEEF(
    beefHex: string,
    options?: ParseOptions,
  ): Promise<ParseTxResponse | ParseTxExtendedResponse> {
    if (!beefHex || typeof beefHex !== 'string' || beefHex.trim() === '') {
      throw stacklessError('A valid BEEF hex string is required');
    }

    let tx: Transaction;
    try {
      tx = Transaction.fromHexBEEF(beefHex);
    } catch {
      throw stacklessError('Invalid BEEF hex: could not deserialise transaction');
    }

    const config = await this.getConfig();
    if (!config) throw stacklessError('Config not fetched');

    return this.parseTransaction(tx, config, options, { noNetwork: true });
  }

  public parseInscription(script: Script) {
    return parseInscription(script);
  }

  public parseCosignerScripts(scripts: Script[]) {
    return parseCosignerScripts(scripts);
  }

  private validateUniqueInputs(inputs: TransferMultiOptions['inputs']): { error?: string } {
    const inputSet = new Set<string>();
    for (const input of inputs) {
      const inputKey = `${input.txid}:${input.vout}`;
      if (inputSet.has(inputKey)) {
        return { error: `Duplicate input detected: ${inputKey}. Each UTXO can only be spent once.` };
      }
      inputSet.add(inputKey);
    }
    return {};
  }

  private async addInputsToTransaction(
    tx: Transaction,
    inputs: TransferMultiOptions['inputs'],
    privateKeys: Map<number, PrivateKey>,
  ): Promise<{ tokensIn: number; error?: string }> {
    let tokensIn = 0;

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const sourceTransaction = await this.fetchRawTx(input.txid);
      if (!sourceTransaction)
        return { tokensIn: 0, error: `Failed to fetch source transaction: ${input.txid}_${input.vout}` };

      const output = sourceTransaction.outputs[input.vout];
      if (!output) return { tokensIn: 0, error: `Output ${input.vout} not found in transaction ${input.txid}` };

      const inscription = this.parseInscriptionData(output.lockingScript);
      if (!inscription) return { tokensIn: 0, error: `No inscription found in output ${input.txid}:${input.vout}` };

      const tokenAmount = parseInt(inscription.amt);
      tokensIn += tokenAmount;

      privateKeys.set(i, PrivateKey.fromWif(input.wif));

      tx.addInput({
        sourceTXID: input.txid,
        sourceOutputIndex: input.vout,
        sourceTransaction,
        unlockingScript: new UnlockingScript(),
      });
    }

    return { tokensIn };
  }

  private calculateTransferMultiFee(
    tokensIn: number,
    totalAtomicTokenAmount: number,
    changeAddress: TransferMultiOptions['changeAddress'],
    inputAddresses: Set<string>,
    config: MNEEConfig,
    recipients: SendMNEE[],
  ): { fee: number; error?: string } {
    let fee = 0;
    let previousFee = -1;

    while (fee !== previousFee) {
      previousFee = fee;

      const totalChange = tokensIn - totalAtomicTokenAmount - fee;

      // Calculate how much change goes to non-input addresses
      let changeToNonInputAddresses = 0;
      if (totalChange > 0) {
        if (typeof changeAddress === 'string') {
          // Single change address
          if (!inputAddresses.has(changeAddress)) {
            changeToNonInputAddresses = totalChange;
          }
        } else if (Array.isArray(changeAddress)) {
          // Multiple change addresses
          for (const changeOutput of changeAddress) {
            const atomicAmount = this.toAtomicAmount(changeOutput.amount);
            if (!inputAddresses.has(changeOutput.address)) {
              changeToNonInputAddresses += atomicAmount;
            }
          }
        } else {
          // Default to first input address - change goes back to input
          changeToNonInputAddresses = 0;
        }
      }

      // Total transfer amount = recipients + change to non-input addresses
      const totalTransferAmount = totalAtomicTokenAmount + changeToNonInputAddresses;

      // Get fee based on total transfer amount
      // const newFee = recipients.find((req) => req.address === config.burnAddress) !== undefined ? 0 : config.fees.find(
      //   (f: { min: number; max: number }) => totalTransferAmount >= f.min && totalTransferAmount <= f.max,
      // )?.fee;

      const newFee = config.fees.find(
        (f: { min: number; max: number }) => totalTransferAmount >= f.min && totalTransferAmount <= f.max,
        )?.fee; // changes made for resolving burnAddress transfer MN-122

      if (newFee === undefined) return { fee: 0, error: 'Fee ranges inadequate' };
      fee = newFee;
    }

    return { fee };
  }

  private async addChangeOutputs(
    tx: Transaction,
    change: number,
    changeAddress: TransferMultiOptions['changeAddress'],
    privateKeys: Map<number, PrivateKey>,
    config: MNEEConfig,
    tokensIn: number,
    totalAtomicTokenAmount: number,
    fee: number,
  ): Promise<{ error?: string }> {
    if (change <= 0) return {};

    if (typeof changeAddress === 'string') {
      // Single change address
      tx.addOutput(await this.createInscription(changeAddress, change, config));
    } else if (Array.isArray(changeAddress)) {
      // Multiple change outputs
      if (changeAddress.length === 0) {
        return {
          error:
            'Change address array cannot be empty. Provide at least one change output or use a single address string.',
        };
      }

      const atomicChangeOutputs = changeAddress.map((c) => ({
        address: c.address,
        amount: this.toAtomicAmount(c.amount),
      }));

      const changeSum = atomicChangeOutputs.reduce((sum, c) => sum + c.amount, 0);
      if (changeSum !== change) {
        const changeDecimal = this.fromAtomicAmount(change);
        const changeSumDecimal = this.fromAtomicAmount(changeSum);
        return {
          error: `Change amounts must sum to ${changeDecimal} (${change} atomic units). Total inputs: ${this.fromAtomicAmount(
            tokensIn,
          )} - total outputs: ${this.fromAtomicAmount(totalAtomicTokenAmount)} - fee: ${this.fromAtomicAmount(
            fee,
          )} = ${changeDecimal}. Your change outputs sum to ${changeSumDecimal} (${changeSum} atomic units).`,
        };
      }

      for (const changeOutput of changeAddress) {
        if (changeOutput.amount <= 0) {
          return { error: `Invalid change amount: ${changeOutput.amount}. Must be positive.` };
        }
      }

      for (const changeOutput of atomicChangeOutputs) {
        tx.addOutput(await this.createInscription(changeOutput.address, changeOutput.amount, config));
      }
    } else {
      // Default to first input's address
      const defaultChangeAddress = privateKeys.get(0)!.toAddress();
      tx.addOutput(await this.createInscription(defaultChangeAddress, change, config));
    }

    return {};
  }

  public createSignatureRequests(tx: Transaction): SignatureRequest[] {
    return tx.inputs.map((input, index) => {
      const sourceTXID = input.sourceTXID ?? input.sourceTransaction?.id('hex');
      if (!sourceTXID) {
        throw stacklessError(`Input ${index} is missing sourceTXID or sourceTransaction`);
      }

      const sourceTransaction = input.sourceTransaction;
      if (!sourceTransaction) {
        throw stacklessError(`Input ${index} is missing sourceTransaction required for signing`);
      }

      const sourceOutput = sourceTransaction.outputs[input.sourceOutputIndex];
      if (!sourceOutput) {
        throw stacklessError(`Output ${input.sourceOutputIndex} not found in transaction ${sourceTXID}`);
      }

      if (sourceOutput.satoshis === undefined) {
        throw stacklessError(`Output ${input.sourceOutputIndex} in transaction ${sourceTXID} is missing satoshis`);
      }

      return {
        prevTxid: sourceTXID,
        outputIndex: input.sourceOutputIndex,
        inputIndex: index,
        address: '', // Will be filled by the signer
        script: sourceOutput.lockingScript.toHex(),
        satoshis: sourceOutput.satoshis,
        sigHashType:
          TransactionSignature.SIGHASH_ALL |
          TransactionSignature.SIGHASH_ANYONECANPAY |
          TransactionSignature.SIGHASH_FORKID,
      };
    });
  }

  private async signAllInputs(tx: Transaction, privateKeys: Map<number, PrivateKey>): Promise<{ error?: string }> {
    const sigRequests = this.createSignatureRequests(tx);

    // Update the address field with the actual addresses from private keys
    sigRequests.forEach((req, index) => {
      req.address = privateKeys.get(index)!.toAddress();
    });

    const rawtx = tx.toHex();
    const allSigResponses: SignatureResponse[] = [];

    for (const [inputIndex, privateKey] of privateKeys.entries()) {
      const inputSigRequest = sigRequests[inputIndex];
      const res = await this.getSignatures({ rawtx, sigRequests: [inputSigRequest] }, privateKey);

      if (!res?.sigResponses) {
        return { error: `Failed to get signatures for input ${inputIndex}` };
      }

      allSigResponses.push(...res.sigResponses);
    }

    this.applySignatures(tx, allSigResponses);

    return {};
  }

  public applySignatures(tx: Transaction, signatures: SignatureResponse[]): Transaction {
    for (const sigResponse of signatures) {
      tx.inputs[sigResponse.inputIndex].unlockingScript = new Script()
        .writeBin(Utils.toArray(sigResponse.sig, 'hex'))
        .writeBin(Utils.toArray(sigResponse.pubKey, 'hex'));
    }
    return tx;
  }

  public async buildUnsignedMneeTransaction(options: MultisigBuildOptions): Promise<UnsignedTransactionResult> {
    const config = await this.getConfig();
    if (!config) throw stacklessError('Config not fetched');

    // Calculate total output amount
    const totalAtomicTokenAmount = options.recipients.reduce((sum, req) => sum + this.toAtomicAmount(req.amount), 0);
    if (totalAtomicTokenAmount <= 0) throw stacklessError('Invalid amount');

    // Build the transaction
    const tx = new Transaction(1, [], [], 0);
    const sourceTransactions = new Map<number, Transaction>();
    let tokensIn = 0;

    // Add inputs
    for (let i = 0; i < options.inputs.length; i++) {
      const input = options.inputs[i];
      const sourceTransaction = await this.fetchRawTx(input.txid);
      if (!sourceTransaction) {
        throw stacklessError(`Failed to fetch source transaction: ${input.txid}_${input.vout}`);
      }

      const output = sourceTransaction.outputs[input.vout];
      if (!output) {
        throw stacklessError(`Output ${input.vout} not found in transaction ${input.txid}`);
      }

      const inscription = this.parseInscriptionData(output.lockingScript);
      if (!inscription) {
        throw stacklessError(`No inscription found in output ${input.txid}:${input.vout}`);
      }

      tokensIn += parseInt(inscription.amt);
      sourceTransactions.set(i, sourceTransaction);

      tx.addInput({
        sourceTXID: input.txid,
        sourceOutputIndex: input.vout,
        sourceTransaction,
        unlockingScript: new UnlockingScript(),
      });
    }

    // Calculate fee
    const fee =
      options.recipients.find((req) => req.address === config.burnAddress) !== undefined
        ? 0
        : config.fees.find(
            (f: { min: number; max: number }) => totalAtomicTokenAmount >= f.min && totalAtomicTokenAmount <= f.max,
          )?.fee;

    if (fee === undefined) throw stacklessError('Fee ranges inadequate');

    // Check if we have enough tokens
    if (tokensIn < totalAtomicTokenAmount + fee) {
      const haveDecimal = this.fromAtomicAmount(tokensIn);
      const needDecimal = this.fromAtomicAmount(totalAtomicTokenAmount + fee);
      throw stacklessError(
        `Insufficient tokens. Have: ${haveDecimal}, Need: ${needDecimal} (including fee: ${this.fromAtomicAmount(
          fee,
        )})`,
      );
    }

    // Add recipient outputs
    for (const req of options.recipients) {
      tx.addOutput(await this.createInscription(req.address, this.toAtomicAmount(req.amount), config));
    }

    // Add fee output if needed
    if (fee > 0) {
      tx.addOutput(await this.createInscription(config.feeAddress, fee, config));
    }

    // Add change output(s)
    const change = tokensIn - totalAtomicTokenAmount - fee;
    if (change > 0) {
      if (!options.changeAddress) {
        // Default to first input - need to extract address from the UTXO
        const firstInput = options.inputs[0];
        const sourceTx = sourceTransactions.get(0)!;
        const sourceOutput = sourceTx.outputs[firstInput.vout];
        const parsedCosigner = parseCosignerScripts([sourceOutput.lockingScript])[0];
        if (!parsedCosigner?.address) {
          throw stacklessError('Could not determine change address from input');
        }
        tx.addOutput(await this.createInscription(parsedCosigner.address, change, config));
      } else if (typeof options.changeAddress === 'string') {
        tx.addOutput(await this.createInscription(options.changeAddress, change, config));
      } else if (Array.isArray(options.changeAddress)) {
        // Multiple change outputs
        const atomicChangeOutputs = options.changeAddress.map((c) => ({
          address: c.address,
          amount: this.toAtomicAmount(c.amount),
        }));

        const changeSum = atomicChangeOutputs.reduce((sum, c) => sum + c.amount, 0);
        if (changeSum !== change) {
          const changeDecimal = this.fromAtomicAmount(change);
          const changeSumDecimal = this.fromAtomicAmount(changeSum);
          throw stacklessError(
            `Change amounts must sum to ${changeDecimal}. Your change outputs sum to ${changeSumDecimal}`,
          );
        }

        for (const changeOutput of atomicChangeOutputs) {
          tx.addOutput(await this.createInscription(changeOutput.address, changeOutput.amount, config));
        }
      }
    }

    // Create signature requests
    const sigRequests = this.createSignatureRequests(tx);

    return {
      transaction: tx,
      sigRequests,
      sourceTransactions,
    };
  }

  private validateTokenConservation(tx: Transaction, tokensIn: number): { error?: string } {
    let totalOut = 0;
    for (let i = 0; i < tx.outputs.length; i++) {
      const output = tx.outputs[i];
      const inscription = this.parseInscriptionData(output.lockingScript);
      if (inscription) {
        const amt = parseInt(inscription.amt);
        totalOut += amt;
      }
    }

    if (tokensIn !== totalOut) {
      return {
        error: `Token conservation violation! Inputs (${this.fromAtomicAmount(
          tokensIn,
        )}) do not equal outputs (${this.fromAtomicAmount(totalOut)}). This would ${
          tokensIn > totalOut ? 'burn' : 'create'
        } ${this.fromAtomicAmount(Math.abs(tokensIn - totalOut))} tokens.`,
      };
    }

    return {};
  }

  // private async broadcastTransaction(tx: Transaction): Promise<{ txid?: string; rawtx?: string; error?: string }> {
  //   try {
  //     const base64Tx = Utils.toBase64(tx.toBinary());
  //     const response = await fetch(`${this.mneeApi}/v1/transfer?auth_token=${this.mneeApiKey}`, {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify({ rawtx: base64Tx }),
  //     });

  //     if (response.status === 401 || response.status === 403) {
  //       throw stacklessError('Invalid API key');
  //     }

  //     if (!response.ok) throw stacklessError(`HTTP error! status: ${response.status}`);

  //     const { rawtx: responseRawtx } = await response.json();
  //     if (!responseRawtx) throw stacklessError('Failed to broadcast transaction');

  //     const decodedBase64AsBinary = Utils.toArray(responseRawtx, 'base64');
  //     const tx2 = Transaction.fromBinary(decodedBase64AsBinary);

  //     return { txid: tx2.id('hex'), rawtx: Utils.toHex(decodedBase64AsBinary) };
  //   } catch (error) {
  //     if (isNetworkError(error)) {
  //       logNetworkError(error, 'broadcast transaction');
  //     }
  //     let errorMessage = 'Transaction broadcast failed';
  //     if (error instanceof Error) {
  //       errorMessage = error.message;
  //     }
  //     throw stacklessError(errorMessage);
  //   }
  // }

  public async transferMulti(
    options: TransferMultiOptions,
    transferOptions?: TransferOptions,
  ): Promise<TransferResponse> {
    try {
      const config = await this.getConfig();
      if (!config) throw stacklessError('Config not fetched');

      const { isValid, error } = validateTransferMultiOptions(options);
      if (!isValid) throw stacklessError(error || 'Invalid transfer options');

      const totalAmount = options.recipients.reduce((sum, req) => sum + req.amount, 0);
      if (totalAmount <= 0) throw stacklessError('Invalid amount');
      const totalAtomicTokenAmount = this.toAtomicAmount(totalAmount);

      const validationResult = this.validateUniqueInputs(options.inputs);
      if (validationResult.error) throw stacklessError(validationResult.error);

      const tx = new Transaction(1, [], [], 0);
      const privateKeys = new Map<number, PrivateKey>();

      const inputResult = await this.addInputsToTransaction(tx, options.inputs, privateKeys);
      if (inputResult.error) throw stacklessError(inputResult.error);
      const tokensIn = inputResult.tokensIn;

      const inputAddresses = new Set<string>();
      for (let i = 0; i < options.inputs.length; i++) {
        const privKey = PrivateKey.fromWif(options.inputs[i].wif);
        inputAddresses.add(privKey.toAddress());
      }

      const feeResult = this.calculateTransferMultiFee(
        tokensIn,
        totalAtomicTokenAmount,
        options.changeAddress,
        inputAddresses,
        config,
        options.recipients,
      );
      if (feeResult.error) throw stacklessError(feeResult.error);
      const fee = feeResult.fee;

      if (tokensIn < totalAtomicTokenAmount + fee) {
        const haveDecimal = this.fromAtomicAmount(tokensIn);
        const needDecimal = this.fromAtomicAmount(totalAtomicTokenAmount + fee);
        throw stacklessError(
          `Insufficient tokens. Have: ${haveDecimal}, Need: ${needDecimal} (including fee: ${this.fromAtomicAmount(
            fee,
          )})`,
        );
      }

      for (const req of options.recipients) {
        tx.addOutput(await this.createInscription(req.address, this.toAtomicAmount(req.amount), config));
      }

      if (fee > 0) {
        tx.addOutput(await this.createInscription(config.feeAddress, fee, config));
      }

      const change = tokensIn - totalAtomicTokenAmount - fee;
      const changeResult = await this.addChangeOutputs(
        tx,
        change,
        options.changeAddress,
        privateKeys,
        config,
        tokensIn,
        totalAtomicTokenAmount,
        fee,
      );
      if (changeResult.error) throw stacklessError(changeResult.error);
      
      if (transferOptions?.extraData) {
        this.addExtraDataOutput(tx, transferOptions.extraData);
      }
      
      const signResult = await this.signAllInputs(tx, privateKeys);
      if (signResult.error) throw stacklessError(signResult.error);

      const conservationResult = this.validateTokenConservation(tx, tokensIn);
      if (conservationResult.error) throw stacklessError(conservationResult.error);

      const rawtx = tx.toHex();

      if (!transferOptions?.broadcast) {
        return { rawtx };
      }

      const now = Date.now();
      for (const input of tx.inputs) {
        this.usedOutpoints.set(`${input.sourceTXID}_${input.sourceOutputIndex}`, now);
      }

      const { ticketId } = await this.submitRawTx(rawtx, transferOptions);
      if (!ticketId) throw stacklessError('Failed to broadcast transaction');

      return { ticketId };
    } catch (error) {
      if (isNetworkError(error)) {
        logNetworkError(error, 'multi-source transfer');
      }
      throw error;
    }
  }
}
