import { Connection } from "@solana/web3.js";

import { parseEnv } from "@bin/parseEnv";
import { RaydiumAmmParser } from "@/lib/parsers/raydium-amm-parser";
import { SolanaParser } from "@/lib/parsers/solana-parser";
import { TransactionFormatter } from "@/lib/transaction-formatter";
import { fetchWithRetry } from "@/lib/utils";

const env = parseEnv();

// Create a connection to the Solana blockchain with a custom fetch function
export const connection = new Connection(`${env.QUICKNODE_ENDPOINT}/${env.QUICKNODE_TOKEN}`, {
  commitment: "confirmed",
  // @ts-expect-error Property 'referrer' is missing in type 'import("undici-types/fetch").Request'
  fetch: fetchWithRetry,
});

// Create formatters & parsers
export const txFormatter = new TransactionFormatter();
export const ixParser = new SolanaParser();
export const raydiumAmmParser = new RaydiumAmmParser();
// Assign the Raydium AMM parser to the Solana parser for transactions from the Raydium AMM program
ixParser.addParser(RaydiumAmmParser.PROGRAM_ID, raydiumAmmParser.parseInstruction.bind(raydiumAmmParser));
