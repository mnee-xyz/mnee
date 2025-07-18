export type Environment = 'production' | 'sandbox';

export type SdkConfig = {
  environment: Environment;
  apiKey?: string;
};

export type MNEEFee = {
  min: number;
  max: number;
  fee: number;
};

export type MNEEConfig = {
  approver: string;
  feeAddress: string;
  burnAddress: string;
  mintAddress: string;
  fees: MNEEFee[];
  decimals: number;
  tokenId: string;
};

export type MNEEOperation = 'transfer' | 'burn' | 'deploy+mint';
export type TxOperation = 'transfer' | 'burn' | 'deploy' | 'mint';

export type MNEEUtxo = {
  data: {
    bsv21: {
      amt: number;
      dec: number;
      icon: string;
      id: string;
      op: string;
      sym: string;
    };
    cosign: {
      address: string;
      cosigner: string;
    };
  };
  height: number;
  idx: number;
  outpoint: string;
  owners: string[];
  satoshis: number;
  score: number;
  script: string;
  txid: string;
  vout: number;
};

export type SignatureRequest = {
  prevTxid: string;
  outputIndex: number;
  inputIndex: number;
  satoshis: number;
  address: string | string[];
  script?: string;
  sigHashType?: number;
  csIdx?: number;
  data?: unknown;
};

export type TransactionFormat = 'tx' | 'beef' | 'ef';

export type MNEEBalance = {
  address: string;
  amount: number;
  decimalAmount: number;
};

export type SendMNEE = {
  address: string;
  amount: number;
};

export type GetSignatures = {
  rawtx: string;
  sigRequests: SignatureRequest[];
  format?: TransactionFormat;
};

export type SignatureResponse = {
  inputIndex: number;
  sig: string;
  pubKey: string;
  sigHashType: number;
  csIdx?: number;
};

export type MneeInscription = {
  p: string;
  op: string;
  id: string;
  amt: string;
};

export type ParsedCosigner = {
  cosigner: string;
  address: string;
};

export interface File {
  hash: string;
  size: number;
  type: string;
  content: number[];
}

export interface Inscription {
  file?: File;
  fields?: { [key: string]: any };
  parent?: string;
}

export type TransferResponse = { txid?: string; rawtx?: string; error?: string };

export type MneeSync = {
  txid: string;
  outs: null;
  height: number;
  idx: number;
  score: number;
  rawtx: string;
  senders: string[];
  receivers: string[];
};

export type Counterparty = {
  address: string;
  amount: number;
};

export type TxStatus = 'confirmed' | 'unconfirmed';
export type TxType = 'send' | 'receive';

export type TxHistory = {
  txid: string;
  height: number;
  status: TxStatus;
  type: TxType;
  amount: number;
  counterparties: Counterparty[];
  fee: number;
  score: number;
};

export type TxHistoryResponse = {
  address: string;
  history: TxHistory[];
  nextScore: number;
};

export type TxAddressAmount = {
  address: string;
  amount: number;
  script?: string;
};

export type ParseTxResponse = {
  txid: string;
  environment: Environment;
  type: TxOperation;
  inputs: TxAddressAmount[];
  outputs: TxAddressAmount[];
};

export interface AddressHistoryParams {
  address: string;
  fromScore?: number;
  limit?: number;
}
