import { BigNumberish, Signer } from "ethers";
import { BytesLike } from "ethers";
import { BaseContract } from "ethers";
import { Contract, ContractTransactionResponse } from "ethers";

export enum FunctionType {
  MINT = 0,
  BURN = 1,
  PAUSE = 2,
  UNPAUSE = 3,
}

export interface MneeContract extends BaseContract {
  name(): Promise<string>;
  symbol(): Promise<string>;
  totalSupply(): Promise<string>;
  mintBurnPauseUnpause(
    target: string,
    amount: bigint,
    fType: FunctionType,
    signers: Signer,
    signatures: Signer[],
    instanceIdentifier: string,
  ): Promise<ContractTransactionResponse>;

  balanceOf(address: string): Promise<BigNumberish>;
  decimals(): Promise<BigNumberish>;
  wait(): Promise<ContractTransactionResponse>;
  transfer(to: string, amount: BigNumberish): Promise<ContractTransactionResponse>;
}

export interface SigningLibrary extends BaseContract {
  getMessageHash(
    target: string,
    to: string,
    amount: bigint,
    fType: FunctionType,
    instanceIdentifier: string,
    chainId: number
  ): Promise<BytesLike>;
}
