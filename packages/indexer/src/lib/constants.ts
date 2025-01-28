import { PublicKey } from "@solana/web3.js";

// Public key of Wrapped SOL (WSOL)
export const WRAPPED_SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
// Public key of the pump.fun mint authority
export const PUMP_FUN_AUTHORITY = new PublicKey("TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM");

// Processing mode for the indexer
export enum ProcessingMode {
  QUEUE = "QUEUE", // wait for the batch to be processed before processing the next batch
  PARALLEL = "PARALLEL", // process each batch as soon as it's ready
}

// Parallel processing mode should be used cautiously with low batch sizes, as it will trigger rate limits if it's too low
export const PROCESSING_MODE: ProcessingMode = ProcessingMode.PARALLEL;
export const MAX_BATCH_SIZE = 100; // 50 swaps per batch is a good lower limit for parallel processing
export const MIN_BATCH_FREQUENCY = 500; // 0.5 seconds
