import { Connection } from "@solana/web3.js";

import { GqlClient } from "@gql/index";
import { Swap } from "@/lib/types";
import { fetchPriceAndMetadata, insertTrades } from "@/lib/utils";

/**
 * Manages swaps as they are coming to be processed in batches with different modes.
 *
 * - In {@link ProcessingMode.QUEUE} mode, batches are processed sequentially.
 * - In {@link ProcessingMode.PARALLEL} mode, batches are processed in parallel as soon as they fit the expected size.
 *
 * Both have tradeoffs and need to be tested depending on the API limits and current network activity.
 *
 * The batcher will process the current batch either when it reaches the max batch size or when the minimum batch
 * frequency has passed, so we don't take any risk of introducing latency. Both of these can be configured in the
 * environment variables.
 *
 * The flow is as follow:
 *
 * 1. Manager is created at initialization.
 * 2. As trades are coming in, formatted and parsed correctly, they are added to the batch.
 * 3. When a batch is processed, we can:
 *
 *    - Retrieve the current price & metadata for each swapped token included in the batch;
 *    - Insert the trades in the database;
 *    - Log the batch processing metrics for debugging purposes.
 *
 * @property {Swap[]} batch - The current batch of swaps
 * @property {number} lastProcessTime - The timestamp of the last time a batch was processed
 * @property {boolean} processing - Whether some batch (or batches) is currently being processed
 * @property {NodeJS.Timeout | null} timer - The timer used to check for processing needs periodically
 */
export class BatchManager {
  private batch: Swap[] = [];
  private lastProcessTime: number = 0;
  private processing: boolean = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private gql: GqlClient["db"],
    private connection: Connection,
    private options: {
      processingMode: "queue" | "parallel";
      maxBatchSize: number;
      minBatchFrequency: number;
    },
  ) {
    // Start the timer to check for processing needs periodically
    this.timer = setInterval(() => {
      this.processIfNeeded();
    }, this.options.minBatchFrequency);
  }

  /**
   * Add a batch of swaps to the manager, to be processed as soon as a requirement is met.
   *
   * @param {Swap[]} swaps - The batch of swaps to add
   */
  async add(swaps: Swap[]) {
    this.batch.push(...swaps);
    await this.processIfNeeded();
  }

  /**
   * Process the current batch if the requirements are met.
   *
   * If it reached the max batch size or the minimum batch frequency has passed, the batch is processed. Except if the
   * processing mode is {@link PROCESSING_MODE.QUEUE}, in which case it will wait for the current batch to be processed
   * before processing the next batch.
   */
  private async processIfNeeded() {
    if (this.batch.length === 0) return;
    // Don't process if in queue mode and already processing
    if (this.options.processingMode === "queue" && this.processing) return;

    const now = Date.now();
    const timeSinceLastProcess = now - this.lastProcessTime;
    const shouldProcessTime = timeSinceLastProcess >= this.options.minBatchFrequency;
    const shouldProcessSize = this.batch.length >= this.options.maxBatchSize;

    // Only process if EITHER:
    // 1. We've hit the max batch size
    // 2. We have items AND enough time has passed since last process
    if (!shouldProcessSize && !(this.batch.length > 0 && shouldProcessTime)) return;

    // Update last process time before processing
    this.lastProcessTime = now;

    try {
      await this.process();
    } catch (error) {
      console.error("Error processing batch:", error);
    }
  }

  /**
   * Process the current batch.
   *
   * 1. Retrieve the current price & metadata for each swapped token included in the batch;
   * 2. Insert the trades in the database;
   * 3. Log the batch processing metrics.
   *
   * @throws {Error} If an error occurs during the batch processing
   */
  private async process() {
    this.processing = true;
    // Retrieve the batch to process and remove it from the manager
    const batchToProcess = this.batch.splice(0, this.options.maxBatchSize);
    // Calculate the highest latency of the batch
    const oldestSwapTime = Math.min(...batchToProcess.map((swap) => swap.timestamp));
    const queueLatency = (Date.now() - oldestSwapTime) / 1000;

    try {
      // Fetch the price & metadata for each swapped token included in the batch
      const {
        swaps: swapsWithData,
        accountsLatency,
        pricesLatency,
      } = await fetchPriceAndMetadata(this.connection, batchToProcess);
      // Insert the trades in the database
      const insertStartTime = Date.now();
      const res = await insertTrades(this.gql, swapsWithData);
      if (res.error) throw res.error.message;

      // Log the batch processing metrics
      this.logBatchMetrics({
        batchSize: batchToProcess.length,
        affectedRows: res.data?.insert_api_trade_history?.affected_rows ?? 0,
        queueLatency,
        accountsLatency,
        pricesLatency,
        insertLatency: (Date.now() - insertStartTime) / 1000,
      });
    } catch (error) {
      console.error("Error processing batch:", error);
      // Add the batch back to the manager if an error occurs
      this.batch.unshift(...batchToProcess);
    } finally {
      this.processing = false;
    }
  }

  /**
   * Log the batch processing metrics.
   *
   * @param {Object} metrics - The latencies and various metrics from the key operations
   */
  private logBatchMetrics({
    batchSize,
    affectedRows,
    queueLatency,
    accountsLatency,
    pricesLatency,
    insertLatency,
  }: {
    batchSize: number;
    affectedRows: number;
    queueLatency: number;
    accountsLatency: number;
    pricesLatency: number;
    insertLatency: number;
  }) {
    console.log(
      [
        "\n=== Batch Processing Metrics ===",
        `Batch size: ${batchSize} | Affected rows: ${affectedRows}`,
        `Queue latency: ${queueLatency.toFixed(2)}s`,
        `Fetch accounts latency: ${accountsLatency.toFixed(2)}s`,
        `Fetch prices latency: ${pricesLatency.toFixed(2)}s`,
        `Upsert latency: ${insertLatency.toFixed(2)}s`,
        `Total processing time: ${(queueLatency + accountsLatency + pricesLatency + insertLatency).toFixed(2)}s`,
        "================================\n",
      ].join("\n"),
    );
  }

  /** Cleanup the BatchManager. */
  cleanup() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
