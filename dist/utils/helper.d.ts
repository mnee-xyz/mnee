import { Script } from '@bsv/sdk';
import { Inscription, MNEEConfig, MneeSync, ParsedCosigner, TxHistory } from '../mnee.types';
export declare const parseInscription: (script: Script) => Inscription | undefined;
export declare const parseCosignerScripts: (scripts: any) => ParsedCosigner[];
export declare const parseSyncToTxHistory: (sync: MneeSync, address: string, config: MNEEConfig) => TxHistory | null;
