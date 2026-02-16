import { HD, Mnemonic } from '@bsv/sdk';
import * as bip39 from 'bip39';
import { stacklessError } from './utils/stacklessError';

/**
 * Note: We're using the HD class from @bsv/sdk despite it being marked as deprecated.
 * The deprecation is because BSV is moving towards BRC-42 (invoice-based key derivation),
 * but for MNEE token management, standard BIP32/BIP44 HD wallets are still the appropriate
 * choice because:
 * - Users expect standard mnemonic/HD wallet functionality
 * - It needs to be compatible with existing wallet software
 * - The use case is for token management, not the privacy-focused invoice system of BRC-42
 */

export interface AddressInfo {
  address: string;
  privateKey: string;
  path: string;
}

export interface HDWalletOptions {
  derivationPath: string;
  cacheSize?: number;
}

export class HDWallet {
  private readonly masterKey: HD;
  private readonly derivationPath: string;
  private readonly cacheSize: number;
  private readonly cache: Map<string, AddressInfo>;

  constructor(mnemonic: string, options: HDWalletOptions) {
    if (!bip39.validateMnemonic(mnemonic)) {
      throw stacklessError('Invalid mnemonic phrase');
    }

    const seed = Mnemonic.fromString(mnemonic).toSeed();
    this.masterKey = HD.fromSeed(seed);
    this.derivationPath = options.derivationPath;
    this.cacheSize = options.cacheSize || 1000;
    this.cache = new Map();
  }

  /**
   * Generate a new random mnemonic phrase
   * @returns A new BIP39 mnemonic phrase (12 words)
   * @example
   * const mnemonic = HDWallet.generateMnemonic();
   * const hdWallet = new HDWallet(mnemonic, { derivationPath: "m/44'/236'/0'" });
   */
  static generateMnemonic(): string {
    return bip39.generateMnemonic();
  }

  /**
   * Validate a mnemonic phrase
   * @param mnemonic - The mnemonic phrase to validate
   * @returns true if valid, false otherwise
   */
  static isValidMnemonic(mnemonic: string): boolean {
    return bip39.validateMnemonic(mnemonic);
  }

  /**
   * Derive individual address with caching
   * @param index - The index of the address to derive
   * @param isChange - Whether this is a change address (default: false)
   * @returns Address information including address, private key, and derivation path
   */
  deriveAddress(index: number, isChange: boolean = false): AddressInfo {
    const changeIndex = isChange ? 1 : 0;
    const fullPath = `${this.derivationPath}/${changeIndex}/${index}`;

    if (this.cache.has(fullPath)) {
      return this.cache.get(fullPath)!;
    }

    const derivedKey = this.masterKey.derive(fullPath);
    const privateKey = derivedKey.privKey;

    if (!privateKey) {
      throw stacklessError(`Failed to derive private key for path: ${fullPath}`);
    }

    const addressInfo: AddressInfo = {
      address: privateKey.toAddress(),
      privateKey: privateKey.toWif(),
      path: fullPath,
    };

    // Add to cache if within limit
    if (this.cache.size < this.cacheSize) {
      this.cache.set(fullPath, addressInfo);
    }

    return addressInfo;
  }

  /**
   * Batch derive addresses for performance
   * @param startIndex - Starting index for derivation
   * @param count - Number of addresses to derive
   * @param isChange - Whether these are change addresses (default: false)
   * @returns Array of address information
   */
  async deriveAddresses(startIndex: number, count: number, isChange: boolean = false): Promise<AddressInfo[]> {
    const addresses: AddressInfo[] = [];

    // Derive addresses in batch
    for (let i = 0; i < count; i++) {
      const index = startIndex + i;
      const addressInfo = this.deriveAddress(index, isChange);
      addresses.push(addressInfo);
    }

    return addresses;
  }

  /**
   * Helper for transferMulti integration - get private keys for specific addresses
   * @param addresses - Array of addresses to get private keys for
   * @param options - Optional configuration for the search
   * @returns Object with private keys and derivation paths for each address
   * @throws Error if any addresses cannot be found within the scan limits
   */
  getPrivateKeysForAddresses(
    addresses: string[],
    options?: {
      maxScanReceive?: number; // Max receive addresses to scan (default: 10000)
      maxScanChange?: number; // Max change addresses to scan (default: 10000)
      scanStrategy?: 'sequential' | 'parallel'; // Scanning strategy (default: 'parallel')
    },
  ): {
    privateKeys: { [address: string]: string };
    paths: { [address: string]: string };
  } {
    const maxScanReceive = options?.maxScanReceive || 10000;
    const maxScanChange = options?.maxScanChange || 10000;
    const scanStrategy = options?.scanStrategy || 'parallel';

    const privateKeys: { [address: string]: string } = {};
    const paths: { [address: string]: string } = {};
    const addressSet = new Set(addresses);

    // First, check the cache for any matching addresses
    for (const [_, info] of this.cache) {
      if (addressSet.has(info.address)) {
        privateKeys[info.address] = info.privateKey;
        paths[info.address] = info.path;
        addressSet.delete(info.address);
      }
    }

    // If we found all addresses in cache, return early
    if (addressSet.size === 0) {
      return { privateKeys, paths };
    }

    // For missing addresses, we need to scan
    if (scanStrategy === 'sequential') {
      // Sequential scanning - scan receive addresses first, then change
      // This is more memory efficient but potentially slower

      // Scan receive addresses
      for (let i = 0; i < maxScanReceive && addressSet.size > 0; i++) {
        const info = this.deriveAddress(i, false);

        if (addressSet.has(info.address)) {
          privateKeys[info.address] = info.privateKey;
          paths[info.address] = info.path;
          addressSet.delete(info.address);
        }
      }

      // Scan change addresses
      for (let i = 0; i < maxScanChange && addressSet.size > 0; i++) {
        const info = this.deriveAddress(i, true);

        if (addressSet.has(info.address)) {
          privateKeys[info.address] = info.privateKey;
          paths[info.address] = info.path;
          addressSet.delete(info.address);
        }
      }
    } else {
      // Parallel scanning - interleave receive and change address scanning
      // This can find addresses faster if they're mixed between receive/change
      const maxScan = Math.max(maxScanReceive, maxScanChange);

      for (let i = 0; i < maxScan && addressSet.size > 0; i++) {
        // Scan receive address at this index
        if (i < maxScanReceive) {
          const receiveInfo = this.deriveAddress(i, false);
          if (addressSet.has(receiveInfo.address)) {
            privateKeys[receiveInfo.address] = receiveInfo.privateKey;
            paths[receiveInfo.address] = receiveInfo.path;
            addressSet.delete(receiveInfo.address);
          }
        }

        // Scan change address at this index
        if (i < maxScanChange) {
          const changeInfo = this.deriveAddress(i, true);
          if (addressSet.has(changeInfo.address)) {
            privateKeys[changeInfo.address] = changeInfo.privateKey;
            paths[changeInfo.address] = changeInfo.path;
            addressSet.delete(changeInfo.address);
          }
        }
      }
    }

    // Check if we found all requested addresses
    if (addressSet.size > 0) {
      const notFound = Array.from(addressSet);
      throw stacklessError(
        `Could not find private keys for ${notFound.length} address(es): ${notFound.join(', ')}. ` +
          `Scanned up to index ${maxScanReceive} for receive addresses and ${maxScanChange} for change addresses.`,
      );
    }

    return { privateKeys, paths };
  }

  /**
   * Helper for transferMulti integration - get private keys for specific addresses (simplified version)
   * @param addresses - Array of addresses to get private keys for
   * @param options - Optional configuration for the search
   * @returns Object mapping addresses to their private keys (WIF format)
   * @throws Error if any addresses cannot be found within the scan limits
   */
  getPrivateKeys(
    addresses: string[],
    options?: {
      maxScanReceive?: number;
      maxScanChange?: number;
      scanStrategy?: 'sequential' | 'parallel';
    },
  ): { [address: string]: string } {
    const result = this.getPrivateKeysForAddresses(addresses, options);
    return result.privateKeys;
  }

  /**
   * Scan for addresses with a gap limit (BIP44 standard)
   * This is useful for finding all used addresses in a wallet
   * @param gapLimit - Number of consecutive unused addresses before stopping (default: 20)
   * @param scanChange - Whether to scan change addresses too (default: true)
   * @param maxScan - Maximum addresses to scan per type (default: 10000)
   * @returns Object with arrays of discovered addresses
   */
  async scanAddressesWithGapLimit(
    checkAddressUsed: (address: string) => Promise<boolean>,
    options?: {
      gapLimit?: number;
      scanChange?: boolean;
      maxScan?: number;
    },
  ): Promise<{
    receive: AddressInfo[];
    change: AddressInfo[];
  }> {
    const gapLimit = options?.gapLimit || 20;
    const scanChange = options?.scanChange !== false;
    const maxScan = options?.maxScan || 10000;

    const result = {
      receive: [] as AddressInfo[],
      change: [] as AddressInfo[],
    };

    // Scan receive addresses
    let consecutiveUnused = 0;
    for (let i = 0; i < maxScan && consecutiveUnused < gapLimit; i++) {
      const info = this.deriveAddress(i, false);
      const isUsed = await checkAddressUsed(info.address);

      if (isUsed) {
        result.receive.push(info);
        consecutiveUnused = 0;
      } else {
        consecutiveUnused++;
      }
    }

    // Scan change addresses if requested
    if (scanChange) {
      consecutiveUnused = 0;
      for (let i = 0; i < maxScan && consecutiveUnused < gapLimit; i++) {
        const info = this.deriveAddress(i, true);
        const isUsed = await checkAddressUsed(info.address);

        if (isUsed) {
          result.change.push(info);
          consecutiveUnused = 0;
        } else {
          consecutiveUnused++;
        }
      }
    }

    return result;
  }

  /**
   * Clear the cache to free memory
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get the current cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}
