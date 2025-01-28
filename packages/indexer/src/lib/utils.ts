// #!/usr/bin/env node
import { Connection, ParsedAccountData, PublicKey } from "@solana/web3.js";

import { GqlClient } from "@gql/index";
import { parseEnv } from "@bin/parseEnv";
import { PUMP_FUN_AUTHORITY, WRAPPED_SOL_MINT } from "@/lib/constants";
import { RaydiumAmmParser } from "@/lib/parsers/raydium-amm-parser";
import {
  GetAssetsResponse,
  GetJupiterPriceResponse,
  ParsedTokenBalanceInfo,
  Swap,
  SwapTokenMetadata,
  SwapWithPriceAndMetadata,
  TransactionWithParsed,
} from "@/lib/types";

const env = parseEnv();

/* --------------------------------- DECODER -------------------------------- */
/**
 * Decodes the swap transaction to retrieve the token traded against WSOL and its amount.
 *
 * This will:
 *
 * 1. Filter out non-Raydium swap instructions;
 * 2. Retrieve the transfer instructions for this swap;
 * 3. Decode them to retrieve the swapped token and its amount.
 *
 * @param txsWithParsedIxs - The transaction with parsed instructions
 * @param timestamp - The current timestamp to fill in any missing time information
 * @returns An array of {@link Swap} objects
 */
export const decodeSwapInfo = (txsWithParsedIxs: TransactionWithParsed[], timestamp: number): Swap[] => {
  // Filter out the instructions that are not related to a Raydium swap
  const programIxs = txsWithParsedIxs.filter(
    (ix) =>
      ix.parsed.programId.toString() === RaydiumAmmParser.PROGRAM_ID.toString() &&
      (ix.parsed.name === "swapBaseIn" || ix.parsed.name === "swapBaseOut"),
  );
  if (programIxs.length === 0) return [];

  // For each instruction
  return programIxs
    .map((ix) => {
      // Retrieve both vaults
      const vaultA = ix.parsed.accounts.find((account) => account.name === "poolCoinTokenAccount")?.pubkey;
      const vaultB = ix.parsed.accounts.find((account) => account.name === "poolPcTokenAccount")?.pubkey;
      if (!vaultA || !vaultB) return;

      // Retrieve the transfer instructions so we can later get the exact amount of tokens traded
      // These two instructions are placed immediately after the swap instruction
      const ixIndex = txsWithParsedIxs.indexOf(ix);
      const transferIxs = [txsWithParsedIxs[ixIndex + 1], txsWithParsedIxs[ixIndex + 2]].filter(
        (ix) => ix !== undefined,
      );
      // Decode the transfer instructions
      const decodedTransferIxs = RaydiumAmmParser.decodeTransferIxs(...transferIxs.map((ix) => ix.raw));

      // Format the source and destination accounts (WSOL and the token) and the amount of tokens traded
      const transferInfo = decodedTransferIxs.map((ix) => ({
        accounts: [ix.args.source, ix.args.destination],
        amount: ix.args.amount,
      }));

      return {
        vaultA,
        vaultB,
        transferInfo,
        timestamp,
      };
    })
    .filter((swap) => swap !== undefined);
};

/* ------------------------------ PROCESS DATA ------------------------------ */
/**
 * Retrieves the price and metadata for tokens traded during swaps.
 *
 * This will:
 *
 * 1. Break the swaps into batches of 50 (max 100 accounts passed to `getMultipleParsedAccounts`);
 * 2. Process each batch in parallel and collect account info;
 * 3. Retrieve the price and metadata for the tokens traded during the swaps;
 * 4. Return the processed swaps, the latency of the accounts lookup, and the latency of the prices lookup.
 *
 * @param connection - The connection instance to the chain
 * @param swaps - The swaps to process
 * @returns An object containing the processed {@link SwapWithPriceAndMetadata} objects, the latency of the accounts
 *   lookup, and the latency of the prices lookup
 */
export const fetchPriceAndMetadata = async (
  connection: Connection,
  swaps: Swap[],
): Promise<{ swaps: SwapWithPriceAndMetadata[]; accountsLatency: number; pricesLatency: number }> => {
  if (swaps.length === 0) return { swaps: [], accountsLatency: 0, pricesLatency: 0 };

  // Break swaps into batches of 50
  // (max 100 accounts passed to `getMultipleParsedAccounts`, so 50 swaps between 2 accounts)
  const batchSize = 50;
  const batches = [];
  for (let i = 0; i < swaps.length; i += batchSize) {
    batches.push(swaps.slice(i, i + batchSize));
  }

  const beforeAllAccounts = Date.now();
  // Process each batch in parallel and collect account info
  const swapsWithAccountInfo = (
    await Promise.all(
      batches.map(async (batchSwaps) => {
        // Get the parsed accounts for each pair of vaults within the batch
        const parsedAccounts = await connection.getMultipleParsedAccounts(
          batchSwaps.map((swap) => [swap.vaultA, swap.vaultB]).flat(),
          { commitment: "confirmed" },
        );
        return batchSwaps.map((swap, i) => {
          // Extract mint info from parsed accounts
          const mintA = (parsedAccounts.value[i * 2]?.data as ParsedAccountData | undefined)?.parsed.info as
            | ParsedTokenBalanceInfo
            | undefined;
          const mintB = (parsedAccounts.value[i * 2 + 1]?.data as ParsedAccountData | undefined)?.parsed.info as
            | ParsedTokenBalanceInfo
            | undefined;

          if (!mintA?.mint || !mintB?.mint) return;

          // Convert mints to strings and check for WSOL
          const mintAStr = mintA.mint.toString();
          const mintBStr = mintB.mint.toString();
          const isWsolA = mintAStr === WRAPPED_SOL_MINT.toString();
          const isWsolB = mintBStr === WRAPPED_SOL_MINT.toString();

          // Skip if neither token is WSOL
          // (this is reminescent of an old version, and could be removed and tested in a later version)
          // (this is the case 99.9% of the time so this doesn't really make too much of a difference)
          if (!isWsolA && !isWsolB) return;

          // Get the non-WSOL token info
          const tokenMint = isWsolA ? mintBStr : mintAStr;
          const tokenVault = isWsolA ? swap.vaultB : swap.vaultA;

          // Find the token amount traded by matching token vault and mint in transfer info
          const amountTraded = swap.transferInfo.find((transfer) => {
            return transfer.accounts.includes(tokenVault);
          })?.amount;
          if (!amountTraded) return;

          // Retrieve the decimals of the token
          const tokenDecimals = isWsolA ? mintB.tokenAmount.decimals : mintA.tokenAmount.decimals;

          return {
            ...swap,
            mintA: mintAStr,
            mintB: mintBStr,
            tokenMint,
            amount: amountTraded,
            tokenDecimals,
          };
        });
      }),
    )
  )
    .flat()
    .filter((swap): swap is NonNullable<typeof swap> => swap !== undefined);

  // Calculate the latency of the accounts lookup
  const accountsLatency = (Date.now() - beforeAllAccounts) / 1000;

  // Get unique token mints for price lookup (excluding WSOL)
  const uniqueMints = new Set(swapsWithAccountInfo.map((swap) => swap.tokenMint));

  // Break unique mints into batches of 49
  const mintBatchSize = 49; // max 49 as from 50+ accounts this Jupiter API call jumps +4s
  const mintBatches = [];
  const uniqueMintsArray = Array.from(uniqueMints);
  for (let i = 0; i < uniqueMintsArray.length; i += mintBatchSize) {
    mintBatches.push(uniqueMintsArray.slice(i, i + mintBatchSize));
  }

  const beforeAllPrices = Date.now();
  // Process each mint batch in parallel
  const priceAndMetadataResponses = await Promise.all(
    mintBatches.map(async (mintBatch) => {
      const mintIds = mintBatch.join(",");
      const [priceResponse, metadataResponse] = await Promise.all([
        // Get the current USD price for each token
        fetchWithRetry(
          `${env.JUPITER_URL}/price?ids=${mintIds}`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          },
          1_000,
        ),
        // Get the metadata for each token
        fetchWithRetry(
          `${env.QUICKNODE_ENDPOINT}/${env.QUICKNODE_TOKEN}`,
          {
            method: "POST",
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "getAssets",
              params: { ids: Array.from(uniqueMints), options: { showFungible: true } },
            }),
            headers: { "Content-Type": "application/json" },
          },
          1_000,
        ),
      ]);
      return { priceResponse, metadataResponse };
    }),
  );

  // Calculate the latency of the prices lookup
  const pricesLatency = (Date.now() - beforeAllPrices) / 1000;

  // Parse price and metadata responses and create a lookup map
  const priceMap = new Map();
  const metadataMap = new Map();

  for (const { priceResponse, metadataResponse } of priceAndMetadataResponses) {
    const [priceData, metadataData] = (await Promise.all([priceResponse.json(), metadataResponse.json()])) as [
      GetJupiterPriceResponse,
      GetAssetsResponse,
    ];

    // Map the price for each token
    for (const [id, { price }] of Object.entries(priceData.data)) {
      priceMap.set(id, price);
    }

    // We need to handle `null` tokens as the DAS API will sometimes return it for tokens that are not yet indexed
    // This can happen with fresh markets
    for (const asset of metadataData.result.filter((asset) => asset !== null)) {
      metadataMap.set(asset.id, asset);
    }
  }

  // Map final results with price data and return the entire object
  return {
    swaps: swapsWithAccountInfo
      .map((swap) => {
        const price = priceMap.get(swap.tokenMint);
        const metadata = metadataMap.get(swap.tokenMint);
        if (price === undefined) return;

        return {
          vaultA: swap.vaultA,
          vaultB: swap.vaultB,
          timestamp: swap.timestamp,
          mint: new PublicKey(swap.tokenMint),
          priceUsd: price,
          amount: swap.amount,
          tokenDecimals: swap.tokenDecimals,
          metadata: formatTokenMetadata(metadata),
        };
      })
      .filter((swap) => swap !== undefined),
    accountsLatency,
    pricesLatency,
  };
};

/**
 * Parses the DAS API response for a token metadata and format it.
 *
 * @param data - The DAS `getAssets` response for the token
 * @returns The formatted {@link SwapTokenMetadata} object
 */
const formatTokenMetadata = (data: GetAssetsResponse["result"][number] | undefined): SwapTokenMetadata => {
  // If this token was not yet indexed by QuickNode, return empty metadata
  if (!data)
    return {
      name: "",
      symbol: "",
      description: "",
      isPumpToken: false,
    };

  const metadata = data.content.metadata;
  const files = data.content.files;
  const links = data.content.links;

  return {
    name: metadata.name,
    symbol: metadata.symbol,
    description: metadata.description,
    // Find the image URI
    imageUri: links?.image ?? files.find((file) => file.mime.startsWith("image") && !!file.uri)?.uri,
    externalUrl: links?.external_url,
    supply: data.token_info?.supply,
    // Find out if this is a pump.fun token by verifying the mint authority
    isPumpToken: data.authorities.some((authority) => authority.address === PUMP_FUN_AUTHORITY.toString()),
  };
};

/* -------------------------------- DATABASE -------------------------------- */
/**
 * Upserts a batch of trades into the database.
 *
 * @param gql - The {@link GqlClient} instance
 * @param trades - The {@link SwapWithPriceAndMetadata} objects to upsert as `api.trade_history` entries
 * @returns The number of trades successfully inserted
 */
export const insertTrades = async (gql: GqlClient["db"], trades: SwapWithPriceAndMetadata[]) => {
  return await gql.InsertTradeHistoryManyMutation({
    trades: trades.map((trade) => {
      // Calculate the volume in USD based on the amount of tokens traded and the price at the time of the trade
      const volumeUsd = (Number(trade.amount) * trade.priceUsd) / 10 ** trade.tokenDecimals;
      const { name, symbol, description, imageUri, externalUrl, supply, isPumpToken } = trade.metadata;

      return {
        token_mint: trade.mint.toString(),
        volume_usd: volumeUsd.toString(),
        token_price_usd: trade.priceUsd.toString(),
        created_at: new Date(trade.timestamp),
        // Format the token metadata as a PostgreSQL composite type
        token_metadata: toPgComposite({
          name: name.slice(0, 255),
          symbol: symbol.slice(0, 10),
          description,
          image_uri: imageUri,
          external_url: externalUrl,
          decimals: trade.tokenDecimals.toString(),
          supply: supply,
          is_pump_token: isPumpToken,
        }),
      };
    }),
  });
};

/**
 * Converts a JavaScript object to a PostgreSQL composite type string.
 *
 * This is used to format the token metadata as a PostgreSQL composite type when inserting trade history.
 *
 * @param obj - The object to convert
 * @returns A string in PostgreSQL composite type format: (val1,val2,...)
 */
export const toPgComposite = (obj: Record<string, unknown>): string => {
  const values = Object.values(obj).map((val) => {
    if (val === null || val === undefined) return null;

    if (typeof val === "string") {
      // Escape special characters and quotes
      const escaped = val
        // Replace backslashes first to avoid double-escaping
        .replace(/\\/g, "\\\\")
        // Escape quotes
        .replace(/"/g, '\\"')
        // Replace newlines
        .replace(/\n/g, "\\n")
        // Replace carriage returns
        .replace(/\r/g, "\\r")
        // Replace tabs
        .replace(/\t/g, "\\t");

      return `"${escaped}"`;
    }

    if (typeof val === "number") {
      return isNaN(val) ? null : val.toString();
    }

    if (typeof val === "boolean") {
      return val.toString();
    }

    // For any other value, convert to string and escape
    const stringVal = val.toString();
    return `"${stringVal.replace(/"/g, '\\"')}"`;
  });

  return `(${values.join(",")})`;
};

/* ---------------------------------- UTILS --------------------------------- */
/**
 * Fetches a URL with retry logic.
 *
 * @param input - The URL to fetch
 * @param init (optional) - The request options
 * @param retry (optional) - The retry delay in milliseconds
 * @param timeout (optional) - The timeout in milliseconds
 * @returns The {@link Response} from the fetch call
 */
export const fetchWithRetry = async (
  input: URL | string,
  init?: RequestInit,
  retry = 5_000,
  timeout = 300_000,
): Promise<Response> => {
  const controller = new AbortController();
  // Set a timeout for the fetch call
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    // Fetch the URL
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });

    // Clear the timeout in case of success
    clearTimeout(id);
    return response;
  } catch (error) {
    // Clear the timeout in case of error
    clearTimeout(id);

    console.error(`Fetch error: ${String(error)}. Retrying in ${retry / 1000} seconds...`);
    // Wait for the retry delay and retry
    await new Promise((resolve) => setTimeout(resolve, retry));
    return fetchWithRetry(input, init, retry, timeout);
  }
};
