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
} from "@bsv/sdk";
import {
  GetSignatures,
  MNEEBalance,
  MNEEConfig,
  MNEEOperation,
  MNEEUtxo,
  SendMNEE,
  SignatureRequest,
  SignatureResponse,
} from "./mnee.types.js";
import CosignTemplate from "./mneeCosignTemplate.js";
import * as jsOneSat from "js-1sat-ord";

export class MNEEService {
  private mneeApiToken = "92982ec1c0975f31979da515d46bae9f";
  private mneeApi = "https://proxy-api.mnee.net";
  private gorillaPoolApi = "https://ordinals.1sat.app";

  constructor(apiToken?: string) {
    if (apiToken) this.mneeApiToken = apiToken;
  }

  /**
   * Fetches the MNEE configuration from the API.
   *
   * @returns {Promise<MNEEConfig | undefined>} A promise that resolves to the MNEE configuration object if successful, or undefined if an error occurs.
   *
   * @throws {Error} Throws an error if the HTTP request fails.
   */
  public async getConfig(): Promise<MNEEConfig | undefined> {
    try {
      const response = await fetch(
        `${this.mneeApi}/v1/config?auth_token=${this.mneeApiToken}`,
        { method: "GET" }
      );
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const data: MNEEConfig = await response.json();
      return data;
    } catch (error) {
      console.error("Failed to fetch config:", error);
      return undefined;
    }
  }

  /**
   * Converts a given amount to its atomic representation based on the specified number of decimals.
   *
   * @param amount - The amount to be converted.
   * @param decimals - The number of decimal places to consider for the atomic conversion.
   * @returns The atomic representation of the given amount.
   */
  public toAtomicAmount(amount: number, decimals: number): number {
    return Math.round(amount * 10 ** decimals);
  }

  private async createInscription(
    recipient: string,
    amount: number,
    config: MNEEConfig
  ) {
    const inscriptionData = {
      p: "bsv-20",
      op: "transfer",
      id: config.tokenId,
      amt: amount.toString(),
    };
    return {
      lockingScript: jsOneSat.applyInscription(
        new CosignTemplate().lock(
          recipient,
          PublicKey.fromString(config.approver)
        ),
        {
          dataB64: Buffer.from(JSON.stringify(inscriptionData)).toString(
            "base64"
          ),
          contentType: "application/bsv-20",
        }
      ),
      satoshis: 1,
    };
  }

  private async getUtxos(
    address: string,
    ops: MNEEOperation[] = ["transfer", "deploy+mint"]
  ): Promise<MNEEUtxo[]> {
    try {
      const response = await fetch(
        `${this.mneeApi}/v1/utxos?auth_token=${this.mneeApiToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify([address]),
        }
      );
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const data: MNEEUtxo[] = await response.json();
      if (ops.length) {
        return data.filter((utxo) =>
          ops.includes(
            utxo.data.bsv21.op.toLowerCase() as
              | "transfer"
              | "burn"
              | "deploy+mint"
          )
        );
      }
      return data;
    } catch (error) {
      console.error("Failed to fetch UTXOs:", error);
      return [];
    }
  }

  private async broadcast(
    tx: Transaction
  ): Promise<BroadcastResponse | BroadcastFailure> {
    const url = `${this.gorillaPoolApi}/v5/tx`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: Buffer.from(tx.toBinary()),
      });
      const body = await response.json();
      if (!response.ok) {
        return {
          status: "error",
          code: response.status.toString(),
          description: body.error || "Unknown error",
        } as BroadcastFailure;
      }
      return {
        status: "success",
        txid: body.txid,
        message: "Transaction broadcast successfully",
      } as BroadcastResponse;
    } catch (error) {
      console.error("Failed to broadcast:", error);
      return {
        status: "error",
        code: "UNKNOWN",
        description: error instanceof Error ? error.message : "Unknown error",
      } as BroadcastFailure;
    }
  }

  private async fetchBeef(txid: string): Promise<Transaction> {
    const resp = await fetch(`${this.gorillaPoolApi}/v5/tx/${txid}/beef`);
    if (resp.status === 404) throw new Error("Transaction not found");
    if (resp.status !== 200) {
      throw new Error(`${resp.status} - Failed to fetch beef for tx ${txid}`);
    }
    const beef = [...Buffer.from(await resp.arrayBuffer())];
    return Transaction.fromAtomicBEEF(beef);
  }

  private async getSignatures(
    request: GetSignatures,
    privateKey: PrivateKey
  ): Promise<{
    sigResponses?: SignatureResponse[];
    error?: { message: string; cause?: any };
  }> {
    try {
      const DEFAULT_SIGHASH_TYPE = 65;
      let tx: Transaction;
      switch (request.format) {
        case "beef":
          tx = Transaction.fromHexBEEF(request.rawtx);
          break;
        case "ef":
          tx = Transaction.fromHexEF(request.rawtx);
          break;
        default:
          tx = Transaction.fromHex(request.rawtx);
          break;
      }
      const sigResponses: SignatureResponse[] = request.sigRequests.flatMap(
        (sigReq: SignatureRequest) => {
          return [privateKey].map((privKey: PrivateKey) => {
            const preimage = TransactionSignature.format({
              sourceTXID: sigReq.prevTxid,
              sourceOutputIndex: sigReq.outputIndex,
              sourceSatoshis: sigReq.satoshis,
              transactionVersion: tx.version,
              otherInputs: tx.inputs.filter(
                (_, index) => index !== sigReq.inputIndex
              ),
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
              sigReq.sigHashType || DEFAULT_SIGHASH_TYPE
            );
            return {
              sig: Utils.toHex(sig.toChecksigFormat()),
              pubKey: privKey.toPublicKey().toString(),
              inputIndex: sigReq.inputIndex,
              sigHashType: sigReq.sigHashType || DEFAULT_SIGHASH_TYPE,
              csIdx: sigReq.csIdx,
            };
          });
        }
      );
      return Promise.resolve({ sigResponses });
    } catch (err: any) {
      console.error("getSignatures error", err);
      return {
        error: {
          message: err.message ?? "unknown",
          cause: err.cause,
        },
      };
    }
  }

  /**
   * Transfers MNEE tokens to specified addresses.
   *
   * @param {SendMNEE[]} request - An array of transfer requests, each containing an address and amount.
   * @param {string} wif - The Wallet Import Format (WIF) string for the private key.
   * @returns {Promise<{ txid?: string; rawtx?: string; error?: string }>} - A promise that resolves to an object containing the transaction ID, raw transaction, or an error message.
   *
   * @throws {Error} If the configuration is not fetched, if the amount is invalid, if the MNEE balance is insufficient, if fee ranges are inadequate, if source transactions cannot be fetched, if signatures cannot be obtained, or if the transaction cannot be broadcast.
   */
  public async transfer(
    request: SendMNEE[],
    wif: string
  ): Promise<{ txid?: string; rawtx?: string; error?: string }> {
    try {
      const config = await this.getConfig();
      if (!config) throw new Error("Config not fetched");

      const totalAmount = request.reduce((sum, req) => sum + req.amount, 0);
      if (totalAmount <= 0) return { error: "Invalid amount" };
      const totalAtomicTokenAmount = this.toAtomicAmount(
        totalAmount,
        config.decimals
      );

      const privateKey = PrivateKey.fromWif(wif);
      const address = privateKey.toAddress();
      const utxos = await this.getUtxos(address);
      const totalUtxoAmount = utxos.reduce(
        (sum, utxo) => sum + (utxo.data.bsv21.amt || 0),
        0
      );
      if (totalUtxoAmount < totalAtomicTokenAmount) {
        return { error: "Insufficient MNEE balance" };
      }

      const fee =
        request.find((req) => req.address === config.burnAddress) !== undefined
          ? 0
          : config.fees.find(
              (fee: { min: number; max: number }) =>
                totalAtomicTokenAmount >= fee.min &&
                totalAtomicTokenAmount <= fee.max
            )?.fee;
      if (fee === undefined) return { error: "Fee ranges inadequate" };

      const tx = new Transaction(1, [], [], 0);
      let tokensIn = 0;
      const signingAddresses: string[] = [];
      let changeAddress = "";

      while (tokensIn < totalAtomicTokenAmount + fee) {
        const utxo = utxos.shift();
        if (!utxo) return { error: "Insufficient MNEE balance" };

        const sourceTransaction = await this.fetchBeef(utxo.txid);
        if (!sourceTransaction)
          return { error: "Failed to fetch source transaction" };

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
        tx.addOutput(
          await this.createInscription(
            req.address,
            this.toAtomicAmount(req.amount, config.decimals),
            config
          )
        );
      }
      if (fee > 0)
        tx.addOutput(
          await this.createInscription(config.feeAddress, fee, config)
        );

      const change = tokensIn - totalAtomicTokenAmount - fee;
      if (change > 0) {
        tx.addOutput(
          await this.createInscription(changeAddress, change, config)
        );
      }

      const sigRequests: SignatureRequest[] = tx.inputs.map((input, index) => {
        if (!input.sourceTXID) throw new Error("Source TXID is undefined");
        return {
          prevTxid: input.sourceTXID,
          outputIndex: input.sourceOutputIndex,
          inputIndex: index,
          address: signingAddresses[index],
          script:
            input.sourceTransaction?.outputs[
              input.sourceOutputIndex
            ].lockingScript.toHex(),
          satoshis:
            input.sourceTransaction?.outputs[input.sourceOutputIndex]
              .satoshis || 1,
          sigHashType:
            TransactionSignature.SIGHASH_ALL |
            TransactionSignature.SIGHASH_ANYONECANPAY |
            TransactionSignature.SIGHASH_FORKID,
        };
      });

      const rawtx = tx.toHex();
      const res = await this.getSignatures({ rawtx, sigRequests }, privateKey);
      if (!res?.sigResponses) return { error: "Failed to get signatures" };

      for (const sigResponse of res.sigResponses) {
        tx.inputs[sigResponse.inputIndex].unlockingScript = new Script()
          .writeBin(Utils.toArray(sigResponse.sig, "hex"))
          .writeBin(Utils.toArray(sigResponse.pubKey, "hex"));
      }

      const base64Tx = Utils.toBase64(tx.toBinary());
      const response = await fetch(
        `${this.mneeApi}/v1/transfer?auth_token=${this.mneeApiToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawtx: base64Tx }),
        }
      );
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const { rawtx: responseRawtx } = await response.json();
      if (!responseRawtx) return { error: "Failed to broadcast transaction" };

      const decodedBase64AsBinary = Utils.toArray(responseRawtx, "base64");
      const tx2 = Transaction.fromBinary(decodedBase64AsBinary);
      await this.broadcast(tx2);

      return { txid: tx2.id("hex"), rawtx: Utils.toHex(decodedBase64AsBinary) };
    } catch (error) {
      let errorMessage = "Transaction submission failed";
      if (error instanceof Error) {
        errorMessage = error.message;
        if (error.message.includes("HTTP error")) {
          // Add more specific error handling if needed based on response status
          console.error("HTTP error details:", error);
        }
      }
      console.error("Failed to transfer tokens:", errorMessage);
      return { error: errorMessage };
    }
  }

  /**
   * Retrieves the balance for a given address.
   *
   * @param address - The address to fetch the balance for.
   * @returns A promise that resolves to an object containing the balance in both raw and decimal formats.
   * @throws Will throw an error if the configuration is not fetched successfully.
   *
   * @example
   * ```typescript
   * const balance = await mneeService.getBalance("some-address");
   * console.log(balance.amount); // Raw balance amount
   * console.log(balance.decimalAmount); // Balance amount in decimal format
   * ```
   */
  public async getBalance(address: string): Promise<MNEEBalance> {
    try {
      const config = await this.getConfig();
      if (!config) throw new Error("Config not fetched");
      const res = await this.getUtxos(address);
      const balance = res.reduce((acc, utxo) => {
        if (utxo.data.bsv21.op === "transfer") {
          acc += utxo.data.bsv21.amt;
        }
        return acc;
      }, 0);

      const decimalAmount = parseFloat(
        (balance / 10 ** (config.decimals || 0)).toFixed(config.decimals)
      );
      return { amount: balance, decimalAmount };
    } catch (error) {
      console.error("Failed to fetch balance:", error);
      return { amount: 0, decimalAmount: 0 };
    }
  }
}
