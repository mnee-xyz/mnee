import { BigNumberish } from "ethers";

export type MNEEERC20Config = {
  name: string;
  symbol: string;
  decimals: BigNumberish;
  totalSupply: BigNumberish;
};

export type Environment = 'MAINNET' | 'TESTNET';