import {
  BroadcastFailure,
  BroadcastResponse,
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
  MNEEOperation,
  MneeSync,
  MNEEUtxo,
  ParseTxResponse,
  SendMNEE,
  SignatureRequest,
  SignatureResponse,
  TxHistory,
  TxHistoryResponse,
  TxOperation,
} from './mnee.types.js';
import CosignTemplate from './mneeCosignTemplate.js';
import * as jsOneSat from 'js-1sat-ord';
import { parseCosignerScripts, parseInscription, parseSyncToTxHistory } from './utils/helper.js';
import {
  MNEE_PROXY_API_URL,
  SANDBOX_MNEE_API_URL,
  GORILLA_POOL_API_URL,
  PROD_TOKEN_ID,
  PROD_ADDRESS,
  DEV_ADDRESS,
  QA_ADDRESS,
  STAGE_ADDRESS,
  PROD_APPROVER,
  QA_TOKEN_ID,
  DEV_TOKEN_ID,
  STAGE_TOKEN_ID,
} from './constants.js';
export class MNEEService {
  private mneeApiKey = '92982ec1c0975f31979da515d46bae9f';
  private mneeConfig: MNEEConfig | undefined;
  private mneeApi: string;
  constructor(config: SdkConfig) {
    if (config?.apiKey) this.mneeApiKey = config.apiKey;
    this.mneeApi = config.environment === 'production' ? MNEE_PROXY_API_URL : SANDBOX_MNEE_API_URL;
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
      console.error('Failed to fetch config:', error);
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

  private async getUtxos(address: string, ops: MNEEOperation[] = ['transfer', 'deploy+mint']): Promise<MNEEUtxo[]> {
    try {
      const response = await fetch(`${this.mneeApi}/v1/utxos?auth_token=${this.mneeApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([address]),
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
      console.error('Failed to fetch UTXOs:', error);
      return [];
    }
  }

  private async broadcast(tx: Transaction): Promise<BroadcastResponse | BroadcastFailure> {
    const url = `${GORILLA_POOL_API_URL}/v5/tx`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: Buffer.from(tx.toBinary()),
      });
      const body = await response.json();
      if (!response.ok) {
        return {
          status: 'error',
          code: response.status.toString(),
          description: body.error || 'Unknown error',
        } as BroadcastFailure;
      }
      return {
        status: 'success',
        txid: body.txid,
        message: 'Transaction broadcast successfully',
      } as BroadcastResponse;
    } catch (error) {
      console.error('Failed to broadcast:', error);
      return {
        status: 'error',
        code: 'UNKNOWN',
        description: error instanceof Error ? error.message : 'Unknown error',
      } as BroadcastFailure;
    }
  }

  private async fetchBeef(txid: string): Promise<Transaction> {
    const resp = await fetch(`${GORILLA_POOL_API_URL}/v5/tx/${txid}/beef`);
    if (resp.status === 404) throw new Error('Transaction not found');
    if (resp.status !== 200) {
      throw new Error(`${resp.status} - Failed to fetch beef for tx ${txid}`);
    }
    const beef = [...Buffer.from(await resp.arrayBuffer())];
    return Transaction.fromAtomicBEEF(beef);
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
      console.error('getSignatures error', err);
      return {
        error: {
          message: err.message ?? 'unknown',
          cause: err.cause,
        },
      };
    }
  }

  public async transfer(request: SendMNEE[], wif: string): Promise<{ txid?: string; rawtx?: string; error?: string }> {
    try {
      const config = this.mneeConfig || (await this.getCosignerConfig());
      if (!config) throw new Error('Config not fetched');

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
      const signingAddresses: string[] = [];
      let changeAddress = '';

      while (tokensIn < totalAtomicTokenAmount + fee) {
        const utxo = utxos.shift();
        if (!utxo) return { error: 'Insufficient MNEE balance' };

        const sourceTransaction = await this.fetchBeef(utxo.txid);
        if (!sourceTransaction) return { error: 'Failed to fetch source transaction' };

        signingAddresses.push(utxo.owners[0]);
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

      const sigRequests: SignatureRequest[] = tx.inputs.map((input, index) => {
        if (!input.sourceTXID) throw new Error('Source TXID is undefined');
        return {
          prevTxid: input.sourceTXID,
          outputIndex: input.sourceOutputIndex,
          inputIndex: index,
          address: signingAddresses[index],
          script: input.sourceTransaction?.outputs[input.sourceOutputIndex].lockingScript.toHex(),
          satoshis: input.sourceTransaction?.outputs[input.sourceOutputIndex].satoshis || 1,
          sigHashType:
            TransactionSignature.SIGHASH_ALL |
            TransactionSignature.SIGHASH_ANYONECANPAY |
            TransactionSignature.SIGHASH_FORKID,
        };
      });

      const rawtx = tx.toHex();
      const res = await this.getSignatures({ rawtx, sigRequests }, privateKey);
      if (!res?.sigResponses) return { error: 'Failed to get signatures' };

      for (const sigResponse of res.sigResponses) {
        tx.inputs[sigResponse.inputIndex].unlockingScript = new Script()
          .writeBin(Utils.toArray(sigResponse.sig, 'hex'))
          .writeBin(Utils.toArray(sigResponse.pubKey, 'hex'));
      }

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
      await this.broadcast(tx2);

      return { txid: tx2.id('hex'), rawtx: Utils.toHex(decodedBase64AsBinary) };
    } catch (error) {
      let errorMessage = 'Transaction submission failed';
      if (error instanceof Error) {
        errorMessage = error.message;
        if (error.message.includes('HTTP error')) {
          // Add more specific error handling if needed based on response status
          console.error('HTTP error details:', error);
        }
      }
      console.error('Failed to transfer tokens:', errorMessage);
      return { error: errorMessage };
    }
  }

  public async getBalance(address: string): Promise<MNEEBalance> {
    try {
      const config = this.mneeConfig || (await this.getCosignerConfig());
      if (!config) throw new Error('Config not fetched');
      const res = await this.getUtxos(address);
      const balance = res.reduce((acc, utxo) => {
        if (utxo.data.bsv21.op === 'transfer') {
          acc += utxo.data.bsv21.amt;
        }
        return acc;
      }, 0);

      const decimalAmount = this.fromAtomicAmount(balance);
      return { amount: balance, decimalAmount };
    } catch (error) {
      console.error('Failed to fetch balance:', error);
      return { amount: 0, decimalAmount: 0 };
    }
  }

  public async validateMneeTx(rawTx: string, request?: SendMNEE[]) {
    try {
      const config = this.mneeConfig || (await this.getCosignerConfig());
      if (!config) throw new Error('Config not fetched');
      const tx = Transaction.fromHex(rawTx);
      const scripts = tx.outputs.map((output) => output.lockingScript);
      const parsedScripts = parseCosignerScripts(scripts);

      if (!request) {
        parsedScripts.forEach((parsed) => {
          if (parsed?.cosigner !== '' && parsed?.cosigner !== config.approver) {
            throw new Error('Invalid or missing cosigner');
          }
        });
      } else {
        request.forEach((req, idx) => {
          const { address, amount } = req;
          const cosigner = parsedScripts.find((parsed) => parsed?.cosigner === config.approver);
          if (!cosigner) {
            throw new Error(`Cosigner not found for address: ${address} at index: ${idx}`);
          }

          const addressFromScript = parsedScripts.find((parsed) => parsed?.address === address);
          if (!addressFromScript) {
            throw new Error(`Address not found in script for address: ${address} at index: ${idx}`);
          }
          const script = tx.outputs[idx].lockingScript;
          const inscription = parseInscription(script);
          const content = inscription?.file?.content;
          if (!content) throw new Error('Invalid inscription content');
          const inscriptionData = Utils.toUTF8(content);
          if (!inscriptionData) throw new Error('Invalid inscription content');
          const inscriptionJson: MneeInscription = JSON.parse(inscriptionData);
          if (inscriptionJson.p !== 'bsv-20') throw new Error(`Invalid bsv 20 protocol: ${inscriptionJson.p}`);
          if (inscriptionJson.op !== 'transfer') throw new Error(`Invalid operation: ${inscriptionJson.op}`);
          if (inscriptionJson.id !== config.tokenId) throw new Error(`Invalid token id: ${inscriptionJson.id}`);
          if (inscriptionJson.amt !== this.toAtomicAmount(amount).toString()) {
            throw new Error(`Invalid amount: ${inscriptionJson.amt}`);
          }
        });
      }

      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  private async getMneeSyncs(address: string, fromScore = 0, limit = 100): Promise<MneeSync[] | undefined> {
    try {
      const response = await fetch(
        `${this.mneeApi}/v1/sync?auth_token=${this.mneeApiKey}&from=${fromScore}&limit=${limit}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([address]),
        },
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data: MneeSync[] = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to fetch config:', error);
      return undefined;
    }
  }

  public async getRecentTxHistory(address: string, fromScore?: number, limit?: number): Promise<TxHistoryResponse> {
    try {
      const config = this.mneeConfig || (await this.getCosignerConfig());
      if (!config) throw new Error('Config not fetched');

      const syncs = await this.getMneeSyncs(address, fromScore, limit);
      if (!syncs || syncs.length === 0) return { history: [], nextScore: fromScore || 0 };

      const txHistory: TxHistory[] = [];
      for (const sync of syncs) {
        const historyItem = parseSyncToTxHistory(sync, address, config);
        if (historyItem) {
          txHistory.push(historyItem);
        }
      }

      const nextScore = txHistory[txHistory.length - 1].score;

      if (limit && txHistory.length > limit) {
        return {
          history: txHistory.slice(0, limit),
          nextScore,
        };
      }

      return {
        history: txHistory,
        nextScore,
      };
    } catch (error) {
      console.error('Failed to fetch tx history:', error);
      return { history: [], nextScore: fromScore || 0 };
    }
  }

  private async parseTransaction(tx: Transaction, config: MNEEConfig): Promise<ParseTxResponse> {
    const txid = tx.id('hex');
    const outScripts = tx.outputs.map((output) => output.lockingScript);
    const sourceTxs = tx.inputs.map((input) => {
      return { txid: input.sourceTXID, vout: input.sourceOutputIndex };
    });

    let inputs = [];
    let outputs = [];
    let inputTotal = 0n;
    let outputTotal = 0n;
    let environment: Environment = 'production';
    let type: TxOperation = 'transfer';
    for (const sourceTx of sourceTxs) {
      if (!sourceTx.txid) continue;
      const fetchedTx = await this.fetchBeef(sourceTx.txid);
      const output = fetchedTx.outputs[sourceTx.vout];
      const parsedCosigner = parseCosignerScripts([output.lockingScript])[0];
      if (parsedCosigner?.address === config.mintAddress) {
        type = txid === config.tokenId.split('_')[0] ? 'deploy' : 'mint';
      }
      const insc = parseInscription(output.lockingScript);
      const content = insc?.file?.content;
      if (!content) continue;
      const inscriptionData = Utils.toUTF8(content);
      if (!inscriptionData) continue;
      const inscriptionJson: MneeInscription = JSON.parse(inscriptionData);
      if (inscriptionJson) {
        const isProdToken = inscriptionJson.id === PROD_TOKEN_ID;
        const isProdApprover = parsedCosigner.cosigner === PROD_APPROVER;
        const isEmptyCosigner = parsedCosigner.cosigner === '';
        const isMint = inscriptionJson.op === 'deploy+mint';
        const isProdAddress = parsedCosigner.address === PROD_ADDRESS;
        const isDevAddress = parsedCosigner.address === DEV_ADDRESS;
        const isQaAddress = parsedCosigner.address === QA_ADDRESS;
        const isStageAddress = parsedCosigner.address === STAGE_ADDRESS;

        if (!isProdToken || !isProdApprover) {
          if (isEmptyCosigner && isMint && isProdAddress) {
            environment = 'production';
            type = 'mint';
          } else {
            environment = 'sandbox';
          }
        }

        if (type === 'transfer' && (isProdAddress || isDevAddress || isQaAddress || isStageAddress)) {
          type = 'mint';
        }

        inputTotal += BigInt(inscriptionJson.amt);
        inputs.push({
          address: parsedCosigner.address,
          amount: parseInt(inscriptionJson.amt),
        });
      }
    }

    for (const script of outScripts) {
      const parsedCosigner = parseCosignerScripts([script])[0];
      const insc = parseInscription(script);
      const content = insc?.file?.content;
      if (!content) continue;
      const inscriptionData = Utils.toUTF8(content);
      if (!inscriptionData) continue;
      const inscriptionJson = JSON.parse(inscriptionData);
      if (inscriptionJson) {
        if (inscriptionJson.op === 'burn') {
          type = 'burn';
        }
        const isProdToken = inscriptionJson.id === PROD_TOKEN_ID;
        const isProdApprover = parsedCosigner.cosigner === PROD_APPROVER;
        const isEmptyCosigner = parsedCosigner.cosigner === '';
        const isProdAddress = parsedCosigner.address === PROD_ADDRESS;
        const isDeploy = inscriptionJson.op === 'deploy+mint';

        if (isDeploy) {
          type = 'deploy';
        }

        if (!isProdToken || !isProdApprover) {
          if (isEmptyCosigner && isProdAddress) {
            environment = 'production';
          } else {
            environment = 'sandbox';
          }
        }
        outputTotal += BigInt(inscriptionJson.amt);
        outputs.push({
          address: parsedCosigner.address,
          amount: parseInt(inscriptionJson.amt),
        });
      }
    }

    if (type !== 'deploy' && inputTotal !== outputTotal) {
      throw new Error('Inputs and outputs are not equal');
    }

    if (txid === PROD_TOKEN_ID.split('_')[0]) {
      environment = 'production';
    } else if ([DEV_TOKEN_ID, QA_TOKEN_ID, STAGE_TOKEN_ID].some((id) => txid === id.split('_')[0])) {
      environment = 'sandbox';
    }

    return { txid, environment, type, inputs, outputs };
  }

  public async parseTx(txid: string): Promise<ParseTxResponse> {
    const config = this.mneeConfig || (await this.getCosignerConfig());
    if (!config) throw new Error('Config not fetched');
    const tx = await this.fetchBeef(txid);
    if (!tx) throw new Error('Failed to fetch transaction');
    return await this.parseTransaction(tx, config);
  }

  public async parseTxFromRawTx(rawTxHex: string): Promise<ParseTxResponse> {
    const tx = Transaction.fromHex(rawTxHex);
    const config = this.mneeConfig || (await this.getCosignerConfig());
    if (!config) throw new Error('Config not fetched');
    return await this.parseTransaction(tx, config);
  }
}
