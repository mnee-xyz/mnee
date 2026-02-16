import { LockingScript } from '@bsv/sdk';
import { stacklessError } from './stacklessError';

/**
 * MAP (Magic Attribute Protocol) metadata object with stringified values for writing to the blockchain
 * @typedef {Object} MAP
 * @property {string} app - Application identifier
 * @property {string} type - Metadata type
 * @property {string} [prop] - Optional. Additional metadata properties
 */
export type MAP = {
  app: string;
  type: string;
  [prop: string]: string;
};

export type Inscription = {
  dataB64: string;
  contentType: string;
};

/**
 * Converts a string to its hexadecimal representation
 *
 * @param {string} utf8Str - The string to convert
 * @returns {string} The hexadecimal representation of the input string
 */
const toHex = (utf8Str: string): string => {
  return Buffer.from(utf8Str).toString('hex');
};

export const MAP_PREFIX = '1PuQa7K62MiKCtssSLKy1kh56WWU7MtUR5';

export const applyInscription = (
  lockingScript: LockingScript,
  inscription?: Inscription,
  metaData?: MAP,
  withSeparator = false,
) => {
  let ordAsm = '';
  // This can be omitted for reinscriptions that just update metadata
  if (inscription?.dataB64 !== undefined && inscription?.contentType !== undefined) {
    const ordHex = toHex('ord');
    const fsBuffer = Buffer.from(inscription.dataB64, 'base64');
    const fileHex = fsBuffer.toString('hex').trim();
    if (!fileHex) {
      throw stacklessError('Invalid file data');
    }
    const fileMediaType = toHex(inscription.contentType);
    if (!fileMediaType) {
      throw stacklessError('Invalid media type');
    }
    ordAsm = `OP_0 OP_IF ${ordHex} OP_1 ${fileMediaType} OP_0 ${fileHex} OP_ENDIF`;
  }

  let inscriptionAsm = `${
    ordAsm ? `${ordAsm} ${withSeparator ? 'OP_CODESEPARATOR ' : ''}` : ''
  }${lockingScript.toASM()}`;

  // MAP.app and MAP.type keys are required
  if (metaData && (!metaData.app || !metaData.type)) {
    throw stacklessError('MAP.app and MAP.type are required fields');
  }

  if (metaData?.app && metaData?.type) {
    const mapPrefixHex = toHex(MAP_PREFIX);
    const mapCmdValue = toHex('SET');
    inscriptionAsm = `${inscriptionAsm ? `${inscriptionAsm} ` : ''}OP_RETURN ${mapPrefixHex} ${mapCmdValue}`;

    for (const [key, value] of Object.entries(metaData)) {
      if (key !== 'cmd') {
        inscriptionAsm = `${inscriptionAsm} ${toHex(key)} ${toHex(value as string)}`;
      }
    }
  }

  return LockingScript.fromASM(inscriptionAsm);
};
