/**
 * Batch operations for MNEE SDK
 * Provides a clean API for batch processing with automatic chunking, rate limiting, and error recovery
 */

import { MNEEService } from './mneeService.js';
import { 
  MNEEUtxo, 
  MNEEBalance, 
  TxHistoryResponse, 
  AddressHistoryParams,
  ParseTxResponse,
  ParseTxExtendedResponse,
  ParseOptions
} from './mnee.types.js';

export interface BatchOptions {
  /** Maximum items per API call (default: 20) */
  chunkSize?: number;
  /** Number of concurrent requests (default: 3) */
  concurrency?: number;
  /** Continue processing if an error occurs (default: false) */
  continueOnError?: boolean;
  /** Progress callback */
  onProgress?: (completed: number, total: number, errors: number) => void;
  /** Delay between chunks in milliseconds (default: 100) */
  delayBetweenChunks?: number;
  /** Maximum retries per chunk (default: 3) */
  maxRetries?: number;
  /** Retry delay in milliseconds (default: 1000) */
  retryDelay?: number;
}

export interface BatchError {
  items: string[];
  error: Error;
  retryCount: number;
}

export interface BatchResult<T> {
  results: T[];
  errors: BatchError[];
  totalProcessed: number;
  totalErrors: number;
}

export interface BatchUtxoResult {
  address: string;
  utxos: MNEEUtxo[];
}

export interface BatchParseTxResult {
  txid: string;
  parsed: ParseTxResponse | ParseTxExtendedResponse;
}

/**
 * Batch operations class for MNEE SDK
 * @example
 * const batch = mnee.batch();
 * const result = await batch.getBalances(addresses, { onProgress: ... });
 */
export class Batch {
  private rateLimiter: RateLimiter;
  
  constructor(private service: MNEEService) {
    // Default rate limiter: max 5 concurrent requests, 100ms minimum delay
    this.rateLimiter = new RateLimiter(5, 100);
  }

  /**
   * Get UTXOs for multiple addresses
   * @example
   * const result = await mnee.batch().getUtxos(addresses, {
   *   onProgress: (completed, total, errors) => {
   *     console.log(`Progress: ${completed}/${total}, Errors: ${errors}`);
   *   }
   * });
   */
  async getUtxos(
    addresses: string[],
    options: BatchOptions = {}
  ): Promise<BatchResult<BatchUtxoResult>> {
    return this.processBatch(
      addresses,
      async (chunk) => {
        const utxos = await this.service.getUtxos(chunk);
        return chunk.map(address => ({
          address,
          utxos: utxos.filter(utxo => utxo.owners.includes(address))
        }));
      },
      options
    );
  }

  /**
   * Get balances for multiple addresses
   * @example
   * const result = await mnee.batch().getBalances(addresses);
   * const totalBalance = result.results.reduce((sum, b) => sum + b.decimalAmount, 0);
   */
  async getBalances(
    addresses: string[],
    options: BatchOptions = {}
  ): Promise<BatchResult<MNEEBalance>> {
    return this.processBatch(
      addresses,
      async (chunk) => this.service.getBalances(chunk),
      options
    );
  }

  /**
   * Get transaction histories for multiple addresses
   * @example
   * const params = addresses.map(addr => ({ address: addr, limit: 100 }));
   * const result = await mnee.batch().getTxHistories(params);
   */
  async getTxHistories(
    params: AddressHistoryParams[],
    options: BatchOptions = {}
  ): Promise<BatchResult<TxHistoryResponse>> {
    return this.processBatch(
      params,
      async (chunk) => this.service.getRecentTxHistories(chunk),
      options,
      (param) => param.address
    );
  }

  /**
   * Parse multiple transactions
   * @example
   * const result = await mnee.batch().parseTx(txids, {
   *   parseOptions: { includeRaw: true }
   * });
   */
  async parseTx(
    txids: string[],
    options: BatchOptions & { parseOptions?: ParseOptions } = {}
  ): Promise<BatchResult<BatchParseTxResult>> {
    const { parseOptions, ...batchOptions } = options;
    
    return this.processBatch(
      txids,
      async (chunk) => {
        const results = await Promise.all(
          chunk.map(async (txid) => ({
            txid,
            parsed: await this.service.parseTx(txid, parseOptions)
          }))
        );
        return results;
      },
      batchOptions
    );
  }

  /**
   * Get all data (UTXOs, balances, and history) for multiple addresses
   * @example
   * const data = await mnee.batch().getAll(addresses, { historyLimit: 50 });
   */
  async getAll(
    addresses: string[],
    options: BatchOptions & { historyLimit?: number } = {}
  ): Promise<{
    utxos: BatchResult<BatchUtxoResult>;
    balances: BatchResult<MNEEBalance>;
    histories: BatchResult<TxHistoryResponse>;
  }> {
    const { historyLimit = 100, ...batchOptions } = options;
    
    // Create history params
    const historyParams: AddressHistoryParams[] = addresses.map(address => ({
      address,
      limit: historyLimit
    }));
    
    // Fetch UTXOs and histories in parallel (no need to fetch balances separately)
    const [utxosResult, histories] = await Promise.all([
      this.getUtxos(addresses, batchOptions),
      this.getTxHistories(historyParams, batchOptions)
    ]);
    
    // Calculate balances from UTXOs to avoid redundant API calls
    const balances = this.calculateBalancesFromUtxos(addresses, utxosResult);
    
    return { utxos: utxosResult, balances, histories };
  }

  /**
   * Calculate balances from UTXO results
   */
  private calculateBalancesFromUtxos(
    addresses: string[],
    utxosResult: BatchResult<BatchUtxoResult>
  ): BatchResult<MNEEBalance> {
    const balanceResults: MNEEBalance[] = [];
    const balanceErrors: BatchError[] = [];
    
    // Process each address to calculate balance from UTXOs
    for (const address of addresses) {
      try {
        // Find UTXOs for this address
        const addressUtxos = utxosResult.results.find(r => r.address === address);
        
        if (!addressUtxos) {
          // If no UTXO result found, check if it was in an error
          const errorItem = utxosResult.errors.find(e => e.items.includes(address));
          if (errorItem) {
            balanceErrors.push(errorItem);
          } else {
            // No UTXOs found, balance is 0
            balanceResults.push({
              address,
              amount: 0,
              decimalAmount: 0
            });
          }
          continue;
        }
        
        // Calculate balance from UTXOs (only count 'transfer' operations)
        const atomicAmount = addressUtxos.utxos.reduce((sum, utxo) => {
          if (utxo.data?.bsv21?.op === 'transfer') {
            return sum + Number(utxo.data.bsv21.amt);
          }
          return sum;
        }, 0);
        
        // Convert to decimal amount
        const decimalAmount = this.service.fromAtomicAmount(atomicAmount);
        
        balanceResults.push({
          address,
          amount: atomicAmount,
          decimalAmount
        });
      } catch (error) {
        balanceErrors.push({
          items: [address],
          error: error as Error,
          retryCount: 0
        });
      }
    }
    
    return {
      results: balanceResults,
      errors: balanceErrors,
      totalProcessed: balanceResults.length + balanceErrors.length,
      totalErrors: balanceErrors.length
    };
  }

  /**
   * Generic batch processor
   */
  private async processBatch<T, R>(
    items: T[],
    processor: (chunk: T[]) => Promise<R[]>,
    options: BatchOptions,
    getItemId?: (item: T) => string
  ): Promise<BatchResult<R>> {
    const {
      chunkSize = 20,
      concurrency = 3,
      continueOnError = false,
      onProgress,
      delayBetweenChunks = 100,
      maxRetries = 3,
      retryDelay = 1000
    } = options;

    if (items.length === 0) {
      return { results: [], errors: [], totalProcessed: 0, totalErrors: 0 };
    }

    const results: R[] = [];
    const errors: BatchError[] = [];
    let processed = 0;

    const chunks = this.chunkArray(items, chunkSize);
    const totalChunks = chunks.length;

    // Process chunks with concurrency control
    for (let i = 0; i < chunks.length; i += concurrency) {
      const batch = chunks.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (chunk) => {
        try {
          const chunkResults = await this.processWithRetry(
            () => processor(chunk),
            maxRetries,
            retryDelay
          );
          
          results.push(...chunkResults);
          processed++;
          
          if (onProgress) {
            onProgress(processed, totalChunks, errors.length);
          }
        } catch (error) {
          const itemIds = getItemId 
            ? chunk.map(item => getItemId(item))
            : chunk as unknown as string[];
            
          errors.push({
            items: itemIds,
            error: error as Error,
            retryCount: maxRetries
          });
          
          if (!continueOnError) {
            throw error;
          }
          
          processed++;
          if (onProgress) {
            onProgress(processed, totalChunks, errors.length);
          }
        }
      });
      
      await Promise.all(batchPromises);
      
      // Add delay between batches
      if (i + concurrency < chunks.length && delayBetweenChunks > 0) {
        await this.delay(delayBetweenChunks);
      }
    }

    return {
      results,
      errors,
      totalProcessed: processed,
      totalErrors: errors.length
    };
  }

  /**
   * Process with retry logic
   */
  private async processWithRetry<T>(
    func: () => Promise<T>,
    maxRetries: number,
    retryDelay: number
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.rateLimiter.execute(func);
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries - 1) {
          await this.delay(retryDelay * (attempt + 1));
        }
      }
    }
    
    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Rate limiter for API calls
 */
class RateLimiter {
  private queue: Array<() => void> = [];
  private running = 0;
  
  constructor(
    private maxConcurrent: number,
    private minDelay: number
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.waitForSlot();
    
    try {
      this.running++;
      const start = Date.now();
      const result = await fn();
      
      // Ensure minimum delay between calls
      const elapsed = Date.now() - start;
      if (elapsed < this.minDelay) {
        await this.delay(this.minDelay - elapsed);
      }
      
      return result;
    } finally {
      this.running--;
      this.processQueue();
    }
  }
  
  private waitForSlot(): Promise<void> {
    if (this.running < this.maxConcurrent) {
      return Promise.resolve();
    }
    
    return new Promise(resolve => {
      this.queue.push(resolve);
    });
  }
  
  private processQueue(): void {
    if (this.queue.length > 0 && this.running < this.maxConcurrent) {
      const next = this.queue.shift();
      if (next) next();
    }
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}