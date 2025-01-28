// #!/usr/bin/env node
import Client, { CommitmentLevel, SubscribeRequest, SubscribeUpdate } from "@triton-one/yellowstone-grpc";

import { createClient as createGqlClient } from "@gql/index";
import { parseEnv } from "@bin/parseEnv";
import { BatchManager } from "@/lib/batch-manager";
import { RaydiumAmmParser } from "@/lib/parsers/raydium-amm-parser";
import { connection, ixParser, txFormatter } from "@/lib/setup";
import { decodeSwapInfo } from "@/lib/utils";

const env = parseEnv();

/* ----------------------------- HANDLE UPDATES ----------------------------- */
/**
 * Handles the incoming transaction updates from the Yellowstone GRPC server.
 *
 * This will:
 *
 * - Format the transaction into a convenient object;
 * - Parse the instructions within the transaction to retrieve informations about the swap;
 * - Add the transaction to the batch manager;
 *
 * Note: `decodeSwapInfo` will only return information about swaps, which is the only type of transaction we're
 * interested in.
 *
 * @param data - The raw data of the transaction streamed from the GRPC server
 * @param batchManager - The batch manager that handles batching for RPC requests
 */
const handleSubscribeUpdate = async (data: SubscribeUpdate, batchManager: BatchManager) => {
  try {
    // Parse the transaction and retrieve the swapped token accounts
    const timestamp = Date.now();
    if (!data.transaction) return;
    const tx = txFormatter.formTransactionFromJson(data.transaction, timestamp);
    if (!tx) return;

    const txsWithParsedIxs = ixParser.parseTransactionWithInnerInstructions(tx);
    const swapInfo = decodeSwapInfo(txsWithParsedIxs, timestamp);
    await batchManager.add(swapInfo);
  } catch (error) {
    console.error("Unexpected error in handleSubscribeUpdate:", error);
  }
};

/* ------------------------------- SETUP GEYSER ------------------------------ */
/**
 * Sets up a connection with the Yellowstone GRPC server and handles the subscription logic.
 *
 * @param batchManager - The batch manager to handle the batching of transactions
 * @param connectionId - The ID of the connection attached to debug logs
 */
const setupGeyserClient = async (batchManager: BatchManager, connectionId: string) => {
  return new Promise((_, reject) => {
    // @ts-expect-error This is a known issue; see https://github.com/rpcpool/yellowstone-grpc/issues/428
    const client = new Client.default(`${env.QUICKNODE_ENDPOINT}:10000`, env.QUICKNODE_TOKEN, {});

    // Subscribe to the stream of transactions
    client
      .subscribe()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((stream: any) => {
        // End the stream if an error occurs (which will restart the connection)
        stream.on("error", (error: unknown) => {
          console.error(`[${connectionId}] Stream error:`, error);
          stream.end();
          reject(error);
        });

        // End the stream if the connection is closed (which will restart the connection)
        stream.on("end", () => {
          console.log(`[${connectionId}] Stream ended`);
          reject(new Error("Stream ended"));
        });

        // Handle the incoming transactions
        stream.on("data", async (data: SubscribeUpdate) => {
          await handleSubscribeUpdate(data, batchManager);
        });

        // Create the config for the subscription request
        const request: SubscribeRequest = {
          slots: { client: { filterByCommitment: true } },
          transactions: {
            client: {
              vote: false,
              failed: false,
              signature: undefined,
              // Only include transactions from the Raydium AMM program
              accountInclude: [RaydiumAmmParser.PROGRAM_ID.toString()],
              accountExclude: [],
              accountRequired: [],
            },
          },
          commitment: CommitmentLevel.CONFIRMED,
          accounts: {},
          transactionsStatus: {},
          entry: {},
          blocks: {},
          blocksMeta: {},
          accountsDataSlice: [],
          ping: undefined,
        };

        // Send the subscription request to the stream
        stream.write(request, (err: unknown) => {
          // End the stream if the subscription request fails (which will restart the connection)
          if (err) {
            console.error(`[${connectionId}] Error sending subscription request:`, err);
            stream.end();
            reject(err);
            return;
          }

          console.log(`[${connectionId}] Subscription started at ${new Date().toISOString()}`);
        });
      })
      .catch(reject);
  });
};

/* --------------------------------- START --------------------------------- */
let currentConnectionId = 0;

/**
 * Starts a connection with the Yellowstone GRPC server and handles the global logic flow for indexing transactions.
 *
 * Note: Connections are labeled with a unique ID to help with debugging.
 *
 * Note: In case of an error, the connection will be restarted with a new ID after a second.
 */
export const start = async () => {
  while (true) {
    const connectionId = `conn_${++currentConnectionId}`;

    try {
      console.log(`[${connectionId}] Starting new Geyser connection`);

      // Create a GQL client to interact with our Timescale database
      const gql = (
        await createGqlClient({
          url: env.NODE_ENV !== "production" ? "http://localhost:8090/v1/graphql" : `${env.HASURA_URL}/v1/graphql`,
          hasuraAdminSecret: env.NODE_ENV !== "production" ? "password" : env.HASURA_ADMIN_SECRET,
        })
      ).db;

      // Create a batch manager to handle the batching of transactions
      const batchManager = new BatchManager(gql, connection, {
        processingMode: env.PROCESSING_MODE,
        maxBatchSize: env.MAX_BATCH_SIZE,
        minBatchFrequency: env.MIN_BATCH_FREQUENCY,
      });

      // Start the connection with the Yellowstone GRPC server
      await setupGeyserClient(batchManager, connectionId);
    } catch (err) {
      console.warn(`[${connectionId}] Error in indexer, restarting in a second...`);
      console.error(err);
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
};
