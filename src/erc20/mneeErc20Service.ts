import {
  Contract,
  ContractTransactionResponse,
  JsonRpcProvider,
  formatUnits,
  parseUnits,
  ZeroAddress,
  getBytes,
  isAddress,
  Wallet,
} from "ethers";
import {
  ETHEREUM_RPC_URL,
  ETHEREUM_MNEE_ADDRESS,
  SEPOLIA_RPC_URL,
  SEPOLIA_MNEE_ADDRESS,
  SEPOLIA_LIBRARY_ADDRESS,
} from "./constants.js";
import { ETHEREUM_MNEE_ABI } from "./abi/prod/MNEE.js";
import { ETHEREUM_LIBRARY_ABI } from "./abi/prod/SigningLibrary.js";
import { SEPOLIA_MNEE_ABI } from "./abi/sepolia/MNEE.js";
import { SEPOLIA_LIBRARY_ABI } from "./abi/sepolia/SigningLibrary.js";
import { createHash } from "crypto";
import { ethers, Signer, Provider } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { MneeContract, SigningLibrary } from "./mnee-contract.js";
import type { InterfaceAbi } from "ethers";
import { Environment, MNEEERC20Config } from "./mneeErc20.types.js";

export class MneeErc20Service {
  private provider!: Provider;
  private signer?: Signer;
  private readonly tokenAbi!: InterfaceAbi;
  private readonly signingLibraryAbi!: InterfaceAbi;
  private readonly tokenAddress!: string;
  private readonly signingLibraryAddress!: string;
  private readonly chainId!: number;

  constructor(env: string, privateKey?: string) {
    if (env === "MAINNET") {
      this.provider = new JsonRpcProvider(ETHEREUM_RPC_URL);
      this.tokenAbi = ETHEREUM_MNEE_ABI;
      this.signingLibraryAbi = ETHEREUM_LIBRARY_ABI;
      this.tokenAddress = ETHEREUM_MNEE_ADDRESS;
      this.chainId = 1;
    } else if (env === "TESTNET") {
      this.provider = new JsonRpcProvider(SEPOLIA_RPC_URL);
      this.tokenAbi = SEPOLIA_MNEE_ABI;
      this.signingLibraryAbi = SEPOLIA_LIBRARY_ABI;
      this.tokenAddress = SEPOLIA_MNEE_ADDRESS;
      this.signingLibraryAddress = SEPOLIA_LIBRARY_ADDRESS;
      this.chainId = 11155111;
    }

    if (privateKey) {
      this.signer = new Wallet(privateKey, this.provider);
    }
  }

  private getReadContract(): MneeContract {
    return new Contract(
      this.tokenAddress,
      this.tokenAbi,
      this.provider,
    ) as unknown as MneeContract;
  }

  private getWriteContract(): MneeContract {
    if (!this.signer) {
      throw new Error("Signer not initialized");
    }

    return new Contract(
      this.tokenAddress,
      this.tokenAbi,
      this.signer,
    ) as unknown as MneeContract;
  }

  private getSigningContract(): SigningLibrary {
    return new Contract(
      this.signingLibraryAddress,
      this.signingLibraryAbi,
      this.signer,
    ) as unknown as SigningLibrary;
  }

  async getBalance(walletAddress: string): Promise<string> {
    if (!walletAddress || !isAddress(walletAddress)) {
      throw new Error(`Invalid address: ${walletAddress}`);
    }
    const contract = this.getReadContract();
    const balance = await contract.balanceOf(walletAddress);
    const decimals = await contract.decimals();

    return formatUnits(balance, decimals);
  }

  async getBalances(
    walletAddresses: string[],
  ): Promise<Record<string, string>> {
    for (const addr of walletAddresses) {
      if (!isAddress(addr)) {
        throw new Error(`Invalid Ethereum address: ${addr}`);
      }
    }
    const contract = this.getReadContract();
    const decimals = await contract.decimals();

    const balances = await Promise.all(
      walletAddresses.map((addr) => contract.balanceOf(addr)),
    );

    const result: Record<string, string> = {};
    walletAddresses.forEach((addr, i) => {
      result[addr] = formatUnits(balances[i], decimals);
    });

    return result;
  }

  async getTokenMetadata(): Promise<MNEEERC20Config> {
    const contract = this.getReadContract();

    const [name, symbol, decimals, totalSupply] = await Promise.all([
      contract.name(),
      contract.symbol(),
      contract.decimals(),
      contract.totalSupply(),
    ]);

    const config: MNEEERC20Config = { name, symbol, decimals, totalSupply };
    return config;
  }

  async transfer(to: string, amount: string): Promise<string> {
    if (!to || !isAddress(to) || to === ethers.ZeroAddress) {
      throw new Error("Invalid recipient address");
    }

    const contract = this.getWriteContract();

    const decimals = await contract.decimals();
    const parsedAmount = parseUnits(amount, decimals);

    if (parsedAmount <= 0n) {
      throw new Error("Transfer amount must be greater than zero");
    }

    const tx = await contract.transfer(to, parsedAmount);
    const receipt = await tx.wait();

    if (!receipt) {
      throw new Error("Transaction not mined");
    }

    return receipt.hash;
  }

  // async multiSigTransfer(
  //   to: string,
  //   amount: string,
  //   executor: Signer,
  //   minters: Signer[],
  // ): Promise<string> {
  //   if (!minters.length) {
  //     throw new Error("At least one minter signer is required");
  //   }
  //   const contract = this.getWriteContract();

  //   const decimals = await contract.decimals();
  //   const parsedAmount = parseUnits(amount, decimals);

  //   const uuidHash = createHash("sha256").update(uuidv4()).digest("hex");
  //   const bytes32Hash = "0x" + uuidHash.slice(0, 64);

  //   const library = this.getSigningContract();
  //   let hash = await library.getMessageHash(
  //     to,
  //     ZeroAddress,
  //     parsedAmount,
  //     0, // operation type = mint & transfer
  //     bytes32Hash,
  //     this.chainId,
  //   );
  //   hash = getBytes(hash);

  //   const signs: Signer[] = [];
  //   const signers: Signer[] = [];
  //   for (let i = 0; i < minters.length; i++) {
  //     signs.push(await minters[i].signMessage(hash));
  //     signers.push(await minters[i].getAddress());
  //   }
  //   const mnee = contract.connect(executor) as unknown as MneeContract;
  //   const tx: ContractTransactionResponse = await mnee.mintBurnPauseUnpause(
  //     to,
  //     parsedAmount,
  //     0, // operation type = mint & transfer
  //     signers,
  //     signs,
  //     bytes32Hash,
  //   );

  //   const receipt = await tx.wait();
  //   return receipt?.hash!;
  // }
}
