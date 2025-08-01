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
  ParseOptions,
} from './mnee.types.js';

export interface BatchOptions {
  /** Maximum items per API call (default: 20) */
  chunkSize?: number;
  /** API requests per second limit (default: 3). If your API key has a higher limit, set this accordingly */
  requestsPerSecond?: number;
  /** Continue processing if an error occurs (default: false) */
  continueOnError?: boolean;
  /** Maximum retries per chunk (default: 3) */
  maxRetries?: number;
  /** Retry delay in milliseconds (default: 1000) */
  retryDelay?: number;
  /** Progress callback */
  onProgress?: (completed: number, total: number, errors: number) => void;
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
  constructor(private service: MNEEService) {}

  /**
   * Get UTXOs for multiple addresses
   * @example
   * const result = await mnee.batch().getUtxos(addresses, {
   *   onProgress: (completed, total, errors) => {
   *     console.log(`Progress: ${completed}/${total}, Errors: ${errors}`);
   *   }
   * });
   */
  async getUtxos(addresses: string[], options: BatchOptions = {}): Promise<BatchResult<BatchUtxoResult>> {
    return this.processBatch(
      addresses,
      async (chunk) => {
        const utxos = await this.service.getUtxos(chunk);
        return chunk.map((address) => ({
          address,
          utxos: utxos.filter((utxo) => utxo.owners.includes(address)),
        }));
      },
      options,
    );
  }

  /**
   * Get balances for multiple addresses
   * @example
   * const result = await mnee.batch().getBalances(addresses);
   * const totalBalance = result.results.reduce((sum, b) => sum + b.decimalAmount, 0);
   */
  async getBalances(addresses: string[], options: BatchOptions = {}): Promise<BatchResult<MNEEBalance>> {
    return this.processBatch(addresses, async (chunk) => this.service.getBalances(chunk), options);
  }

  /**
   * Get transaction histories for multiple addresses
   * @example
   * const params = addresses.map(addr => ({ address: addr, limit: 100 }));
   * const result = await mnee.batch().getTxHistories(params);
   */
  async getTxHistories(
    params: AddressHistoryParams[],
    options: BatchOptions = {},
  ): Promise<BatchResult<TxHistoryResponse>> {
    return this.processBatch(
      params,
      async (chunk) => this.service.getRecentTxHistories(chunk),
      options,
      (param) => param.address,
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
    options: BatchOptions & { parseOptions?: ParseOptions } = {},
  ): Promise<BatchResult<BatchParseTxResult>> {
    const { parseOptions, ...batchOptions } = options;

    // Track individual errors within chunks
    const individualErrors: BatchError[] = [];

    const modifiedProcessor = async (chunk: string[]) => {
      const results = await Promise.allSettled(
        chunk.map(async (txid) => {
          // Validate txid first
          if (!txid || typeof txid !== 'string' || txid.trim() === '') {
            throw new Error('Invalid transaction ID: empty or not a string');
          }
          
          const hexRegex = /^[a-fA-F0-9]{64}$/;
          if (!hexRegex.test(txid)) {
            throw new Error(`Invalid transaction ID format: ${txid}`);
          }

          return {
            txid,
            parsed: await this.service.parseTx(txid, parseOptions),
          };
        }),
      );

      const successfulResults: BatchParseTxResult[] = [];
      
      results.forEach((result, index) => {
        const txid = chunk[index];
        if (result.status === 'fulfilled') {
          successfulResults.push(result.value);
        } else {
          // Track individual errors
          individualErrors.push({
            items: [txid],
            error: result.reason as Error,
            retryCount: 0,
          });
        }
      });

      return successfulResults;
    };

    const batchResult = await this.processBatch(
      txids,
      modifiedProcessor,
      { ...batchOptions, continueOnError: true }, // Always continue on error for parseTx
    );

    // Merge individual errors with any chunk-level errors
    return {
      ...batchResult,
      errors: [...batchResult.errors, ...individualErrors],
      totalErrors: batchResult.errors.length + individualErrors.length,
    };
  }

  /**
   * Generic batch processor
   */
  private async processBatch<T, R>(
    items: T[],
    processor: (chunk: T[]) => Promise<R[]>,
    options: BatchOptions,
    getItemId?: (item: T) => string,
  ): Promise<BatchResult<R>> {
    const {
      chunkSize = 20,
      continueOnError = false,
      onProgress,
      maxRetries = 3,
      retryDelay = 1000,
      requestsPerSecond = 3,
    } = options;
    
    const validChunkSize = chunkSize > 0 ? chunkSize : 20;

    // Create rate limiter based on requests per second
    // Use requestsPerSecond as both the max concurrent and to calculate delay
    const minDelay = Math.ceil(1000 / requestsPerSecond);
    const rateLimiter = new RateLimiter(requestsPerSecond, minDelay);

    if (items.length === 0) {
      return { results: [], errors: [], totalProcessed: 0, totalErrors: 0 };
    }

    const results: R[] = [];
    const errors: BatchError[] = [];
    let processed = 0;

    const chunks = this.chunkArray(items, validChunkSize);
    const totalChunks = chunks.length;

    // Process all chunks - rate limiter handles concurrency and timing
    const chunkPromises = chunks.map(async (chunk) => {
      try {
        const chunkResults = await this.processWithRetry(() => processor(chunk), maxRetries, retryDelay, rateLimiter);

        results.push(...chunkResults);
        processed++;

        if (onProgress) {
          onProgress(processed, totalChunks, errors.length);
        }

        return chunkResults;
      } catch (error) {
        if (!continueOnError) {
          throw error;
        }

        // When continueOnError is true and chunk processing fails,
        // try to process items individually to salvage partial results
        const partialResults: R[] = [];
        const failedItems: { item: T; error: Error }[] = [];

        for (const item of chunk) {
          try {
            // Process single item by wrapping in array
            const singleResult = await this.processWithRetry(
              () => processor([item]),
              maxRetries,
              retryDelay,
              rateLimiter,
            );
            if (singleResult.length > 0) {
              partialResults.push(...singleResult);
            }
          } catch (itemError) {
            failedItems.push({ item, error: itemError as Error });
          }
        }

        // Add partial results
        results.push(...partialResults);

        // Record errors for failed items
        if (failedItems.length > 0) {
          const itemIds = failedItems.map(({ item }) => (getItemId ? getItemId(item) : (item as unknown as string)));
          errors.push({
            items: itemIds,
            error: failedItems[0].error, // Use first error as representative
            retryCount: maxRetries,
          });
        }

        processed++;
        if (onProgress) {
          onProgress(processed, totalChunks, errors.length);
        }

        return partialResults;
      }
    });

    // Wait for all chunks to complete
    await Promise.all(chunkPromises);

    return {
      results,
      errors,
      totalProcessed: processed,
      totalErrors: errors.length,
    };
  }

  /**
   * Process with retry logic
   */
  private async processWithRetry<T>(
    func: () => Promise<T>,
    maxRetries: number,
    retryDelay: number,
    rateLimiter: RateLimiter,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await rateLimiter.execute(func);
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
    const size = Math.max(1, chunkSize); // Ensure chunk size is at least 1
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Rate limiter for API calls
 */
export class RateLimiter {
  private queue: Array<() => void> = [];
  private running = 0;

  constructor(private maxConcurrent: number, private minDelay: number) {}

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

    return new Promise((resolve) => {
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
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
