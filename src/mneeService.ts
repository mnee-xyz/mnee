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
} from '@bsv/sdk';
import {
  Environment,
  GetSignatures,
  MNEEBalance,
  MNEEConfig,
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
  ParsedCosigner,
  TxAddressAmount,
  TransferResponse,
} from './mnee.types.js';
import CosignTemplate from './mneeCosignTemplate.js';
import * as jsOneSat from 'js-1sat-ord';
import { parseCosignerScripts, parseInscription, parseSyncToTxHistory, validateAddress } from './utils/helper.js';
import { isNetworkError, logNetworkError } from './utils/networkError.js';
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
  MIN_TRANSFER_AMOUNT,
} from './constants.js';
import { RateLimiter } from './batch.js';

// Helper interfaces for parseTransaction refactoring
interface ProcessedInput {
  address?: string;
  amount: number;
  satoshis: number;
  inscription?: MneeInscription | null;
  cosigner?: ParsedCosigner;
}

interface ProcessedOutput {
  address?: string;
  amount: number;
  satoshis: number;
  inscription?: MneeInscription | null;
  cosigner?: ParsedCosigner;
}

export class MNEEService {
  private mneeApiKey: string;
  private mneeConfig: MNEEConfig | undefined;
  private mneeApi: string;

  constructor(config: SdkConfig) {
    if (config.environment !== 'production' && config.environment !== 'sandbox') {
      throw new Error('Invalid environment. Must be either "production" or "sandbox"');
    }

    const isProd = config.environment === 'production';
    if (config?.apiKey) {
      this.mneeApiKey = config.apiKey;
    } else {
      this.mneeApiKey = isProd ? PUBLIC_PROD_MNEE_API_TOKEN : PUBLIC_SANDBOX_MNEE_API_TOKEN;
    }
    this.mneeApi = isProd ? MNEE_PROXY_API_URL : SANDBOX_MNEE_API_URL;
    this.getCosignerConfig();
  }

  public async getCosignerConfig(): Promise<MNEEConfig | undefined> {
    try {
      const response = await fetch(`${this.mneeApi}/v1/config?auth_token=${this.mneeApiKey}`, { method: 'GET' });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data: MNEEConfig = await response.json();
      this.mneeConfig = data;
      return data;
    } catch (error) {
      if (isNetworkError(error)) {
        logNetworkError(error, 'fetch config');
      }
      return undefined;
    }
  }

  public toAtomicAmount(amount: number): number {
    if (!this.mneeConfig) throw new Error('Config not fetched');
    return Math.round(amount * 10 ** this.mneeConfig.decimals);
  }

  public fromAtomicAmount(amount: number): number {
    if (!this.mneeConfig) throw new Error('Config not fetched');
    return amount / 10 ** this.mneeConfig.decimals;
  }

  private async createInscription(recipient: string, amount: number, config: MNEEConfig) {
    const inscriptionData = {
      p: 'bsv-20',
      op: 'transfer',
      id: config.tokenId,
      amt: amount.toString(),
    };
    return {
      lockingScript: jsOneSat.applyInscription(
        new CosignTemplate().lock(recipient, PublicKey.fromString(config.approver)),
        {
          dataB64: Buffer.from(JSON.stringify(inscriptionData)).toString('base64'),
          contentType: 'application/bsv-20',
        },
      ),
      satoshis: 1,
    };
  }

  public async getUtxos(address: string | string[]): Promise<MNEEUtxo[]> {
    try {
      const ops = ['transfer', 'deploy+mint'];
      const arrayAddress = Array.isArray(address) ? address : [address];
      const response = await fetch(`${this.mneeApi}/v1/utxos?auth_token=${this.mneeApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(arrayAddress),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data: MNEEUtxo[] = await response.json();
      if (ops.length) {
        return data.filter((utxo) =>
          ops.includes(utxo.data.bsv21.op.toLowerCase() as 'transfer' | 'burn' | 'deploy+mint'),
        );
      }
      return data;
    } catch (error) {
      if (isNetworkError(error)) {
        logNetworkError(error, 'fetch UTXOs');
      }
      return [];
    }
  }

  private async fetchRawTx(txid: string): Promise<Transaction | undefined> {
    try {
      const resp = await fetch(`${this.mneeApi}/v1/tx/${txid}?auth_token=${this.mneeApiKey}`);
      if (resp.status === 404) throw new Error('Transaction not found');
      if (resp.status !== 200) {
        throw new Error(`${resp.status} - Failed to fetch rawtx for txid: ${txid}`);
      }
      const { rawtx } = await resp.json();
      return Transaction.fromHex(Buffer.from(rawtx, 'base64').toString('hex'));
    } catch (error) {
      if (isNetworkError(error)) {
        logNetworkError(error, 'fetch transaction');
      }
      return undefined;
    }
  }

  private async getSignatures(
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

  public async transfer(
    request: SendMNEE[],
    wif: string,
    broadcast: boolean = true,
  ): Promise<{ txid?: string; rawtx?: string; error?: string }> {
    try {
      const config = this.mneeConfig || (await this.getCosignerConfig());
      if (!config) throw new Error('Config not fetched');

      for (const req of request) {
        if (req.amount < MIN_TRANSFER_AMOUNT) {
          return { error: `Invalid amount for ${req.address}: minimum transfer amount is ${MIN_TRANSFER_AMOUNT} MNEE` };
        }
      }

      const totalAmount = request.reduce((sum, req) => sum + req.amount, 0);
      if (totalAmount <= 0) return { error: 'Invalid amount' };
      const totalAtomicTokenAmount = this.toAtomicAmount(totalAmount);

      const privateKey = PrivateKey.fromWif(wif);
      const address = privateKey.toAddress();
      const utxos = await this.getUtxos(address);
      const totalUtxoAmount = utxos.reduce((sum, utxo) => sum + (utxo.data.bsv21.amt || 0), 0);
      if (totalUtxoAmount < totalAtomicTokenAmount) {
        return { error: 'Insufficient MNEE balance' };
      }

      const fee =
        request.find((req) => req.address === config.burnAddress) !== undefined
          ? 0
          : config.fees.find(
              (fee: { min: number; max: number }) =>
                totalAtomicTokenAmount >= fee.min && totalAtomicTokenAmount <= fee.max,
            )?.fee;
      if (fee === undefined) return { error: 'Fee ranges inadequate' };

      const tx = new Transaction(1, [], [], 0);
      let tokensIn = 0;
      let changeAddress = '';

      while (tokensIn < totalAtomicTokenAmount + fee) {
        const utxo = utxos.shift();
        if (!utxo) return { error: 'Insufficient MNEE balance' };

        const sourceTransaction = await this.fetchRawTx(utxo.txid);
        if (!sourceTransaction) return { error: 'Failed to fetch source transaction' };

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

      const privateKeys = new Map<number, PrivateKey>();
      for (let i = 0; i < tx.inputs.length; i++) {
        privateKeys.set(i, privateKey);
      }

      const signResult = await this.signAllInputs(tx, privateKeys);
      if (signResult.error) return signResult;

      if (!broadcast) {
        return { rawtx: tx.toHex() };
      }

      return await this.broadcastTransaction(tx);
    } catch (error) {
      if (isNetworkError(error)) {
        logNetworkError(error, 'transfer tokens');
      }
      let errorMessage = 'Transaction submission failed';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      return { error: errorMessage };
    }
  }

  public async submitRawTx(rawtx: string): Promise<TransferResponse> {
    try {
      if (!rawtx) {
        return { error: 'Raw transaction is required' };
      }
      const tx = Transaction.fromHex(rawtx);
      const response = await this.broadcastTransaction(tx);
      return response;
    } catch (error) {
      if (isNetworkError(error)) {
        logNetworkError(error, 'submit raw transaction');
      }
      return { error: 'Failed to submit raw transaction' };
    }
  }

  public async getBalance(address: string): Promise<MNEEBalance> {
    // Validate address before making any API calls
    if (!validateAddress(address)) {
      const error = new Error('Invalid Bitcoin address');
      console.error('Invalid Bitcoin address:', error.message);
      throw error;
    }

    try {
      const config = this.mneeConfig || (await this.getCosignerConfig());
      if (!config) throw new Error('Config not fetched');

      const utxos = await this.getUtxos(address);
      const balance = utxos.reduce((acc, utxo) => {
        if (utxo.data.bsv21.op === 'transfer') {
          acc += utxo.data.bsv21.amt;
        }
        return acc;
      }, 0);
      const decimalAmount = this.fromAtomicAmount(balance);
      return { address, amount: balance, decimalAmount };
    } catch (error) {
      if (isNetworkError(error)) {
        logNetworkError(error, 'fetch balance');
      }
      return { address, amount: 0, decimalAmount: 0 };
    }
  }

  public async getBalances(addresses: string[]): Promise<MNEEBalance[]> {
    // Validate all addresses before making any API calls
    addresses.forEach((addr) => {
      if (!validateAddress(addr)) {
        const error = new Error(`Invalid Bitcoin address: ${addr}`);
        console.error('Invalid Bitcoin address:', error.message);
        throw error;
      }
    });

    try {
      const config = this.mneeConfig || (await this.getCosignerConfig());
      if (!config) throw new Error('Config not fetched');

      const utxos = await this.getUtxos(addresses);
      return addresses.map((addr) => {
        const addressUtxos = utxos.filter((utxo) => utxo.owners.includes(addr));
        const balance = addressUtxos.reduce((acc, utxo) => {
          if (utxo.data.bsv21.op === 'transfer') {
            acc += utxo.data.bsv21.amt;
          }
          return acc;
        }, 0);
        return { address: addr, amount: balance, decimalAmount: this.fromAtomicAmount(balance) };
      });
    } catch (error) {
      if (isNetworkError(error)) {
        logNetworkError(error, 'fetch balances');
      }
      return addresses.map((addr) => ({ address: addr, amount: 0, decimalAmount: 0 }));
    }
  }

  private processMneeValidation(tx: Transaction, config: MNEEConfig, request?: SendMNEE[]) {
    try {
      // Deploy transactions are always valid
      const txid = tx.id('hex');
      if (txid === config.tokenId.split('_')[0]) {
        return true;
      }

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
        throw new Error('Invalid cosigner detected');
      }

      // Get all valid MNEE inscriptions
      const mneeInscriptions = outputDetails.filter((output) => {
        if (!output.inscription) return false;

        const insc = output.inscription as MneeInscription;
        if (insc.p !== 'bsv-20') return false;

        // Check token ID
        if (insc.id !== config.tokenId) {
          throw new Error(`Invalid token ID: ${insc.id}`);
        }

        // Validate amount
        const amt = parseInt(insc.amt, 10);
        if (isNaN(amt) || amt <= 0) {
          throw new Error(`Invalid MNEE amount: ${insc.amt}`);
        }

        return true;
      });

      if (mneeInscriptions.length === 0) {
        throw new Error('No valid MNEE inscriptions found in transaction');
      }

      // Check what operations we have
      const operations = new Set(mneeInscriptions.map((o) => (o.inscription as MneeInscription).op));
      const hasTransfer = operations.has('transfer');
      const hasBurn = operations.has('burn');

      // Require cosigner for transfer and burn operations
      if ((hasTransfer || hasBurn) && !hasCosigner) {
        throw new Error('Cosigner not found in transaction with transfer/burn operation');
      }

      // Filter to just transfers for request validation
      const mneeTransfers = mneeInscriptions.filter((output) => {
        const insc = output.inscription as MneeInscription;
        return insc.op === 'transfer';
      });

      // If request is provided, validate it matches the transaction
      if (request) {
        // Ensure we have enough outputs for all requests (including duplicates)
        const remainingOutputs = [...mneeTransfers];
        for (const req of request) {
          const outputIndex = remainingOutputs.findIndex(
            (output) =>
              output.address === req.address &&
              (output.inscription as MneeInscription).amt === this.toAtomicAmount(req.amount).toString(),
          );

          if (outputIndex === -1) {
            throw new Error(`No matching output found for ${req.address} with amount ${req.amount}`);
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
      const config = this.mneeConfig || (await this.getCosignerConfig());
      if (!config) throw new Error('Config not fetched');
      const tx = Transaction.fromHex(rawTx);
      const isValid = this.processMneeValidation(tx, config, request);

      if (!isValid) return false;

      const txid = tx.id('hex');
      if (txid === config.tokenId.split('_')[0]) {
        return true;
      }

      const inputData = await this.processTransactionInputs(tx, config);
      const outputData = this.processTransactionOutputs(tx, config);

      if (inputData.total !== outputData.total) {
        return false;
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
    fromScore = 0,
    limit = 100,
  ): Promise<{ address: string; syncs: MneeSync[] }[]> {
    try {
      const addressArray = Array.isArray(addresses) ? addresses : [addresses];
      const response = await fetch(
        `${this.mneeApi}/v1/sync?auth_token=${this.mneeApiKey}&from=${fromScore}&limit=${limit}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(addressArray),
        },
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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
      return Array.isArray(addresses)
        ? addresses.map((address) => ({ address, syncs: [] }))
        : [{ address: addresses, syncs: [] }];
    }
  }

  public async getRecentTxHistory(address: string, fromScore?: number, limit?: number): Promise<TxHistoryResponse> {
    try {
      const config = this.mneeConfig || (await this.getCosignerConfig());
      if (!config) throw new Error('Config not fetched');

      const syncsByAddress = await this.getMneeSyncs(address, fromScore, limit);
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
      return { address, history: [], nextScore: fromScore || 0 };
    }
  }

  public async getRecentTxHistories(params: AddressHistoryParams[]): Promise<TxHistoryResponse[]> {
    try {
      const config = this.mneeConfig || (await this.getCosignerConfig());
      if (!config) throw new Error('Config not fetched');

      // Group addressParams by fromScore and limit to batch requests efficiently
      const groupedParams: Record<string, AddressHistoryParams[]> = {};
      params.forEach((param) => {
        const key = `${param.fromScore || 0}:${param.limit || 100}`;
        if (!groupedParams[key]) {
          groupedParams[key] = [];
        }
        groupedParams[key].push(param);
      });

      // Process each group in parallel
      const groupPromises = Object.entries(groupedParams).map(async ([key, addressParams]) => {
        const [fromScore, limit] = key.split(':').map(Number);
        const addresses = addressParams.map((p) => p.address);

        const syncsByAddress = await this.getMneeSyncs(addresses, fromScore, limit);

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
          for (const sync of syncs) {
            const historyItem = parseSyncToTxHistory(sync, address, config);
            if (historyItem) {
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
      return params.map(({ address, fromScore }) => ({
        address,
        history: [],
        nextScore: fromScore || 0,
      }));
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
  ): Promise<{
    inputs: ProcessedInput[];
    total: bigint;
    environment?: Environment;
    type?: TxOperation;
  }> {
    const txid = tx.id('hex');
    const inputs: ProcessedInput[] = new Array(tx.inputs.length);
    let total = BigInt(0);
    let environment: Environment | undefined;
    let type: TxOperation | undefined;

    // Create a rate limiter for 3 requests per second (default MNEE API rate limit ok being hardcoded)
    const rateLimiter = new RateLimiter(3, 334);

    const fetchTasks = tx.inputs.map(async (input, index) => {
      if (!input.sourceTXID) {
        return { index, sourceTx: null };
      }

      try {
        const sourceTx = await rateLimiter.execute(() => this.fetchRawTx(input.sourceTXID!));
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

  private processTransactionOutputs(
    tx: Transaction,
    config: MNEEConfig,
  ): {
    outputs: ProcessedOutput[];
    total: bigint;
    environment?: Environment;
    type?: TxOperation;
  } {
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
  ): Promise<ParseTxResponse | ParseTxExtendedResponse> {
    const txid = tx.id('hex');

    const inputData = await this.processTransactionInputs(tx, config);
    const outputData = this.processTransactionOutputs(tx, config);

    const environment = outputData.environment || inputData.environment || 'sandbox';

    let type = outputData.type || inputData.type || 'transfer';

    if (type === 'transfer') {
      const hasMintInputAddress = inputData.inputs.some(
        (input) => input.inscription && (input.address === PROD_MINT_ADDRESS || input.address === SANDBOX_MINT_ADDRESS),
      );

      if (hasMintInputAddress) {
        type = 'mint';
      }
    }

    // If there are no inputs with inscriptions, it can be nothing but a deploy
    const inputsWithInscriptions = inputData.inputs.filter((input) => input.inscription);
    if (inputsWithInscriptions.length === 0 && inputData.inputs.length > 0) {
      type = 'deploy';
    }

    const isValid = this.validateTransaction(config, tx, type, inputData.total, outputData.total);

    return this.buildParseResponse(txid, environment, type, inputData, outputData, isValid, tx, options);
  }

  public async parseTx(txid: string, options?: ParseOptions): Promise<ParseTxResponse | ParseTxExtendedResponse> {
    const config = this.mneeConfig || (await this.getCosignerConfig());
    if (!config) throw new Error('Config not fetched');
    const tx = await this.fetchRawTx(txid);
    if (!tx) throw new Error('Failed to fetch transaction');
    return await this.parseTransaction(tx, config, options);
  }

  public async parseTxFromRawTx(
    rawTxHex: string,
    options?: ParseOptions,
  ): Promise<ParseTxResponse | ParseTxExtendedResponse> {
    const tx = Transaction.fromHex(rawTxHex);
    const config = this.mneeConfig || (await this.getCosignerConfig());
    if (!config) throw new Error('Config not fetched');
    return await this.parseTransaction(tx, config, options);
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
      if (!sourceTransaction) return { tokensIn: 0, error: `Failed to fetch source transaction: ${input.txid}` };

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

  private calculateTransferFee(
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
      const newFee =
        recipients.find((req) => req.address === config.burnAddress) !== undefined
          ? 0
          : config.fees.find(
              (f: { min: number; max: number }) => totalTransferAmount >= f.min && totalTransferAmount <= f.max,
            )?.fee;

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

  private async signAllInputs(tx: Transaction, privateKeys: Map<number, PrivateKey>): Promise<{ error?: string }> {
    const sigRequests: SignatureRequest[] = tx.inputs.map((input, index) => {
      if (!input.sourceTXID) throw new Error('Source TXID is undefined');
      return {
        prevTxid: input.sourceTXID,
        outputIndex: input.sourceOutputIndex,
        inputIndex: index,
        address: privateKeys.get(index)!.toAddress(),
        script: input.sourceTransaction?.outputs[input.sourceOutputIndex].lockingScript.toHex(),
        satoshis: input.sourceTransaction?.outputs[input.sourceOutputIndex].satoshis || 1,
        sigHashType:
          TransactionSignature.SIGHASH_ALL |
          TransactionSignature.SIGHASH_ANYONECANPAY |
          TransactionSignature.SIGHASH_FORKID,
      };
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

    for (const sigResponse of allSigResponses) {
      tx.inputs[sigResponse.inputIndex].unlockingScript = new Script()
        .writeBin(Utils.toArray(sigResponse.sig, 'hex'))
        .writeBin(Utils.toArray(sigResponse.pubKey, 'hex'));
    }

    return {};
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

  private async broadcastTransaction(tx: Transaction): Promise<{ txid?: string; rawtx?: string; error?: string }> {
    try {
      const base64Tx = Utils.toBase64(tx.toBinary());
      const response = await fetch(`${this.mneeApi}/v1/transfer?auth_token=${this.mneeApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawtx: base64Tx }),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const { rawtx: responseRawtx } = await response.json();
      if (!responseRawtx) return { error: 'Failed to broadcast transaction' };

      const decodedBase64AsBinary = Utils.toArray(responseRawtx, 'base64');
      const tx2 = Transaction.fromBinary(decodedBase64AsBinary);

      return { txid: tx2.id('hex'), rawtx: Utils.toHex(decodedBase64AsBinary) };
    } catch (error) {
      if (isNetworkError(error)) {
        logNetworkError(error, 'broadcast transaction');
      }
      let errorMessage = 'Transaction broadcast failed';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      return { error: errorMessage };
    }
  }

  public async transferMulti(
    options: TransferMultiOptions,
    broadcast: boolean = true,
  ): Promise<{ txid?: string; rawtx?: string; error?: string }> {
    try {
      const config = this.mneeConfig || (await this.getCosignerConfig());
      if (!config) throw new Error('Config not fetched');

      for (const req of options.recipients) {
        if (req.amount < MIN_TRANSFER_AMOUNT) {
          return { error: `Invalid amount for ${req.address}: minimum transfer amount is ${MIN_TRANSFER_AMOUNT} MNEE` };
        }
      }

      if (options.changeAddress && Array.isArray(options.changeAddress)) {
        for (const change of options.changeAddress) {
          if (change.amount < MIN_TRANSFER_AMOUNT) {
            return { error: `Invalid amount for ${change.address}: minimum transfer amount is ${MIN_TRANSFER_AMOUNT} MNEE` };
          }
        }
      }

      const totalAmount = options.recipients.reduce((sum, req) => sum + req.amount, 0);
      if (totalAmount <= 0) return { error: 'Invalid amount' };
      const totalAtomicTokenAmount = this.toAtomicAmount(totalAmount);

      const validationResult = this.validateUniqueInputs(options.inputs);
      if (validationResult.error) return validationResult;

      const tx = new Transaction(1, [], [], 0);
      const privateKeys = new Map<number, PrivateKey>();

      const inputResult = await this.addInputsToTransaction(tx, options.inputs, privateKeys);
      if (inputResult.error) return { error: inputResult.error };
      const tokensIn = inputResult.tokensIn;

      const inputAddresses = new Set<string>();
      for (let i = 0; i < options.inputs.length; i++) {
        const privKey = PrivateKey.fromWif(options.inputs[i].wif);
        inputAddresses.add(privKey.toAddress());
      }

      const feeResult = this.calculateTransferFee(
        tokensIn,
        totalAtomicTokenAmount,
        options.changeAddress,
        inputAddresses,
        config,
        options.recipients,
      );
      if (feeResult.error) return { error: feeResult.error };
      const fee = feeResult.fee;

      if (tokensIn < totalAtomicTokenAmount + fee) {
        const haveDecimal = this.fromAtomicAmount(tokensIn);
        const needDecimal = this.fromAtomicAmount(totalAtomicTokenAmount + fee);
        return {
          error: `Insufficient tokens. Have: ${haveDecimal}, Need: ${needDecimal} (including fee: ${this.fromAtomicAmount(
            fee,
          )})`,
        };
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
      if (changeResult.error) return changeResult;

      const signResult = await this.signAllInputs(tx, privateKeys);
      if (signResult.error) return signResult;

      const conservationResult = this.validateTokenConservation(tx, tokensIn);
      if (conservationResult.error) return conservationResult;

      if (!broadcast) {
        return { rawtx: tx.toHex() };
      }

      return await this.broadcastTransaction(tx);
    } catch (error) {
      if (isNetworkError(error)) {
        logNetworkError(error, 'multi-source transfer');
      }
      let errorMessage = 'Multi-source transfer failed';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      return { error: errorMessage };
    }
  }
}
