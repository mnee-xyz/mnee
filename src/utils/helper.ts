import { Hash, OP, Script, Utils } from '@bsv/sdk';
import { Inscription, ParsedCosigner } from '../mnee.types';

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

export const parseCosignerScripts = (scripts: any): ParsedCosigner[] => {
  return scripts.map((script: any) => {
    const chunks = script.chunks;
    for (let i = 0; i <= chunks.length - 6; i++) {
      if (
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
      }
    }
  });
};
