export declare function AES(input: number[], key: number[]): number[];
export declare const checkBit: (byteArray: number[], byteIndex: number, bitIndex: number) => 1 | 0;
export declare const getBytes: (numericValue: number) => number[];
export declare const exclusiveOR: (block0: number[], block1: number[]) => number[];
export declare const rightShift: (block: number[]) => number[];
export declare const multiply: (block0: number[], block1: number[]) => number[];
export declare const incrementLeastSignificantThirtyTwoBits: (block: number[]) => number[];
export declare function ghash(input: number[], hashSubKey: number[]): number[];
export declare function AESGCM(plainText: number[], additionalAuthenticatedData: number[], initializationVector: number[], key: number[]): {
    result: number[];
    authenticationTag: number[];
};
export declare function AESGCMDecrypt(cipherText: number[], additionalAuthenticatedData: number[], initializationVector: number[], authenticationTag: number[], key: number[]): number[] | null;
//# sourceMappingURL=AESGCM.d.ts.map