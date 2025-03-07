import { Script } from '@bsv/sdk';
import { Inscription, ParsedCosigner } from '../mnee.types';
export declare const parseInscription: (script: Script) => Inscription | undefined;
export declare const parseCosignerScripts: (scripts: any) => ParsedCosigner[];
