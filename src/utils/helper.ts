import { Hash, OP, Script, Transaction, Utils, PrivateKey } from '@bsv/sdk';
import {
  Inscription,
  MNEEConfig,
  MneeInscription,
  MneeSync,
  ParsedCosigner,
  SendMNEE,
  TransferMultiOptions,
  TxHistory,
  TxStatus,
  TxType,
} from '../mnee.types';
import { stacklessError } from './stacklessError';
import { MIN_TRANSFER_AMOUNT } from '../constants';

export const parseInscription = (script: Script) => {
  let fromPos: number | undefined;
  for (let i = 0; i < script.chunks.length; i++) {
    const chunk = script.chunks[i];
    if (
      i >= 2 &&
      chunk.data?.length === 3 &&
      Utils.toUTF8(chunk.data) == 'ord' &&
      script.chunks[i - 1].op == OP.OP_IF &&
      script.chunks[i - 2].op == OP.OP_FALSE
    ) {
      fromPos = i + 1;
    }
  }
  if (fromPos === undefined) return;

  const insc = {
    file: { hash: '', size: 0, type: '' },
    fields: {},
  } as Inscription;

  for (let i = fromPos; i < script.chunks.length; i += 2) {
    const field = script.chunks[i];
    if (field.op == OP.OP_ENDIF) {
      break;
    }
    if (field.op > OP.OP_16) return;
    const value = script.chunks[i + 1];
    if (value.op > OP.OP_PUSHDATA4) return;

    if (field.data?.length) continue;

    let fieldNo = 0;
    if (field.op > OP.OP_PUSHDATA4 && field.op <= OP.OP_16) {
      fieldNo = field.op - 80;
    } else if (field.data?.length) {
      fieldNo = field.data[0];
    }
    switch (fieldNo) {
      case 0:
        insc.file!.size = value.data?.length || 0;
        if (!value.data?.length) break;
        insc.file!.hash = Utils.toBase64(Hash.sha256(value.data));
        insc.file!.content = value.data;
        break;
      case 1:
        insc.file!.type = Buffer.from(value.data || []).toString();
        break;
    }
  }

  return insc;
};

export const parseCosignerScripts = (scripts: Script[]): ParsedCosigner[] => {
  return scripts
    .map((script: Script) => {
      const chunks = script.chunks;
      for (let i = 0; i <= chunks.length - 4; i++) {
        if (
          chunks.length > i + 6 &&
          chunks[0 + i].op === OP.OP_DUP &&
          chunks[1 + i].op === OP.OP_HASH160 &&
          chunks[2 + i].data?.length === 20 &&
          chunks[3 + i].op === OP.OP_EQUALVERIFY &&
          chunks[4 + i].op === OP.OP_CHECKSIGVERIFY &&
          chunks[5 + i].data?.length === 33 &&
          chunks[6 + i].op === OP.OP_CHECKSIG
        ) {
          return {
            cosigner: Utils.toHex(chunks[5 + i].data || []),
            address: Utils.toBase58Check(chunks[2 + i].data || [], [0]),
          };
        } else if (
          // P2PKH
          chunks[0 + i].op === OP.OP_DUP &&
          chunks[1 + i].op === OP.OP_HASH160 &&
          chunks[2 + i].data?.length === 20 &&
          chunks[3 + i].op === OP.OP_EQUALVERIFY &&
          chunks[4 + i].op === OP.OP_CHECKSIG
        ) {
          return {
            cosigner: '',
            address: Utils.toBase58Check(chunks[2 + i].data || [], [0]),
          };
        }
      }
      // Return undefined for scripts that don't match any pattern
      return undefined as any;
    })
    .filter((result): result is ParsedCosigner => result !== undefined);
};

export const parseSyncToTxHistory = (sync: MneeSync, address: string, config: MNEEConfig): TxHistory | null => {
  const txType: TxType = sync.senders.includes(address) ? 'send' : 'receive';
  const txStatus: TxStatus = sync.height > 0 ? 'confirmed' : 'unconfirmed';

  if (!sync.rawtx) return null;

  const txArray = Utils.toArray(sync.rawtx, 'base64');
  const txHex = Utils.toHex(txArray);
  const tx = Transaction.fromHex(txHex);

  const outScripts = tx.outputs.map((output) => output.lockingScript);
  const mneeScripts = parseCosignerScripts(outScripts);
  const parsedOutScripts = outScripts.map(parseInscription);
  const mneeAddresses = mneeScripts.map((script) => script.address);

  const feeAddressIndex = mneeAddresses.indexOf(config.feeAddress);
  const sender = sync.senders[0]; // only one sender for now

  let fee = 0;
  const counterpartyAmounts = new Map<string, number>();

  parsedOutScripts.forEach((parsedScript, index) => {
    const content = parsedScript?.file?.content;
    if (!content) return;

    const inscriptionData = Utils.toUTF8(content);
    if (!inscriptionData) return;

    let inscriptionJson: MneeInscription;
    try {
      inscriptionJson = JSON.parse(inscriptionData);
    } catch (err) {
      console.error('Failed to parse inscription JSON:', err);
      return;
    }

    if (inscriptionJson.p !== 'bsv-20' || inscriptionJson.id !== config.tokenId) return;

    const inscriptionAmt = parseInt(inscriptionJson.amt, 10);
    if (Number.isNaN(inscriptionAmt)) return;

    if (feeAddressIndex === index && sender === address) {
      fee += inscriptionAmt;
      return;
    }

    const outAddr = mneeAddresses[index];
    const prevAmt = counterpartyAmounts.get(outAddr) || 0;
    counterpartyAmounts.set(outAddr, prevAmt + inscriptionAmt);
  });

  const amountSentToAddress = counterpartyAmounts.get(address) || 0;

  if (txType === 'send') {
    const senderAmt = counterpartyAmounts.get(sender) || 0;
    counterpartyAmounts.set(sender, senderAmt - amountSentToAddress);
  }

  let counterparties: { address: string; amount: number }[] = [];
  if (txType === 'receive') {
    counterparties = [{ address: sender, amount: amountSentToAddress }];
  } else {
    counterparties = Array.from(counterpartyAmounts.entries())
      .map(([addr, amt]) => ({ address: addr, amount: amt }))
      .filter((cp) => cp.address !== address && cp.address !== config.feeAddress && cp.amount > 0);
  }

  const totalCounterpartyAmount = counterparties.reduce((sum, cp) => sum + cp.amount, 0);

  return {
    txid: sync.txid,
    height: sync.height,
    type: txType,
    status: txStatus,
    amount: totalCounterpartyAmount,
    fee,
    score: sync.score,
    counterparties,
  };
};

export const validateAddress = (address: string) => {
  try {
    const decoded = Utils.fromBase58Check(address);
    // 0x00 = mainnet P2PKH (addresses starting with '1')
    const validPrefixes = [0x00];
    const prefixByte = decoded.prefix[0];
    if (typeof prefixByte !== 'number' || !validPrefixes.includes(prefixByte)) {
      throw stacklessError(`Invalid address prefix: ${prefixByte}`);
    }
    // Ensure the payload is 20 bytes (160 bits) for P2PKH/P2SH
    if (decoded.data.length !== 20) {
      throw stacklessError(`Invalid address payload length: ${decoded.data.length}`);
    }
    return true;
  } catch (error) {
    return false;
  }
};

export const validateWIF = (wif: string): { isValid: boolean; error?: string; privateKey?: PrivateKey } => {
  try {
    const privateKey = PrivateKey.fromWif(wif);
    return { isValid: true, privateKey };
  } catch (wifError) {
    if (wifError instanceof Error) {
      const errorMsg = wifError.message.toLowerCase();
      if (errorMsg.includes('invalid base58 character')) {
        return { isValid: false, error: 'Invalid WIF key: contains invalid characters' };
      } else if (errorMsg.includes('invalid checksum')) {
        return { isValid: false, error: 'Invalid WIF key: checksum verification failed' };
      } else if (errorMsg.includes('expected base58 string')) {
        return { isValid: false, error: 'Invalid WIF key: must be a valid base58 encoded string' };
      }
    }
    return { isValid: false, error: 'Invalid WIF key provided' };
  }
};

export const validateTransferMultiOptions = (options: TransferMultiOptions): { isValid: boolean; error?: string } => {
  for (const recipient of options.recipients) {
    if (!recipient.address || !recipient.amount) {
      return {
        isValid: false,
        error: `Invalid recipient: ${JSON.stringify(recipient)}. Missing required fields: address, amount`,
      };
    }

    if (typeof recipient.amount !== 'number' || isNaN(recipient.amount) || !isFinite(recipient.amount)) {
      return { isValid: false, error: `Invalid amount for ${recipient.address}: amount must be a valid number` };
    }

    if (recipient.amount < MIN_TRANSFER_AMOUNT) {
      return {
        isValid: false,
        error: `Invalid amount for ${recipient.address}: minimum transfer amount is ${MIN_TRANSFER_AMOUNT} MNEE`,
      };
    }

    if (!validateAddress(recipient.address)) {
      return { isValid: false, error: `Invalid recipient address: ${recipient.address}` };
    }
  }

  for (const input of options.inputs) {
    if (!input.txid || !input.vout || !input.wif) {
      return {
        isValid: false,
        error: `Invalid input: ${JSON.stringify(input)}. Missing required fields: txid, vout, wif`,
      };
    }
    const wifValidation = validateWIF(input.wif);
    if (!wifValidation.isValid) {
      return { isValid: false, error: `Invalid WIF key: ${input.wif} for input ${input.txid}:${input.vout}` };
    }
    const privateKey = wifValidation.privateKey!;
    const address = privateKey.toAddress();
    if (!validateAddress(address)) {
      return { isValid: false, error: `Invalid input address: ${address}` };
    }
  }

  if (options.changeAddress && Array.isArray(options.changeAddress)) {
    for (const change of options.changeAddress) {
      if (change.amount < MIN_TRANSFER_AMOUNT) {
        return {
          isValid: false,
          error: `Invalid amount for ${change.address}: minimum transfer amount is ${MIN_TRANSFER_AMOUNT} MNEE`,
        };
      }
      if (!validateAddress(change.address)) {
        return { isValid: false, error: `Invalid change address: ${change.address}` };
      }
    }
  }

  return { isValid: true };
};

export const validateTransferOptions = (options: SendMNEE[], wif: string): { isValid: boolean; totalAmount?: number; privateKey?: PrivateKey; error?: string } => {
  const { isValid, error, privateKey } = validateWIF(wif);
  if (!isValid) {
    return { isValid: false, error: error || 'Invalid WIF key provided' };
  }

  // This should never happen, but just in case
  if (!privateKey) {
    return { isValid: false, error: 'Private key not found' };
  }

  let totalAmount = 0;
  for (const req of options) {
    if (!validateAddress(req.address)) {
      return { isValid: false, error: `Invalid recipient address: ${req.address}` };
    }
    if (typeof req.amount !== 'number' || isNaN(req.amount) || !isFinite(req.amount)) {
      return { isValid: false, error: `Invalid amount for ${req.address}: amount must be a valid number` };
    }
    if (req.amount < MIN_TRANSFER_AMOUNT) {
      return { isValid: false, error: `Invalid amount for ${req.address}: minimum transfer amount is ${MIN_TRANSFER_AMOUNT} MNEE` };
    }
    totalAmount += req.amount;
  }

  if (totalAmount <= 0) return { isValid: false, error: 'Invalid amount: total must be greater than 0' };

  return { isValid: true, totalAmount, privateKey };
};
