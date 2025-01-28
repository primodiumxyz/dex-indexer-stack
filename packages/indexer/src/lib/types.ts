import { Idl } from "@coral-xyz/anchor";
import { ParsedInstruction } from "@shyft-to/solana-transaction-parser";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";

/* ------------------------------- PARSED DATA ------------------------------ */

/**
 * A parsed swap containing relevant data from the transaction.
 *
 * @property {PublicKey} vaultA - The "poolCoinTokenAccount" vault
 * @property {PublicKey} vaultB - The "poolPcTokenAccount" vault
 * @property {TransferInformation[]} transferInfo - The transfer information (accounts and amount swapped)
 * @property {number} timestamp - The timestamp of the transaction
 */
export type Swap = {
  vaultA: PublicKey;
  vaultB: PublicKey;
  transferInfo: TransferInformation[];
  timestamp: number;
};

/**
 * A parsed swap containing relevant data from the transaction, as well as the price and metadata of the token traded.
 *
 * @property {Swap} swap - The {@link Swap} object minus the transfer information
 * @property {SwapTokenPrice} price - The {@link SwapTokenPrice} object
 * @property {SwapTokenMetadata} metadata - The {@link SwapTokenMetadata} object
 */
export type SwapWithPriceAndMetadata = Omit<Swap, "transferInfo"> &
  SwapTokenPrice & {
    metadata: SwapTokenMetadata;
  };

/**
 * The transfer information for a swap; tokens swapped and amount.
 *
 * @property {PublicKey[]} accounts - The accounts involved in the transfer
 * @property {bigint} amount - The amount of tokens transferred
 */
type TransferInformation = {
  accounts: PublicKey[];
  amount: bigint;
};

/**
 * The numerical information relevant to a swap.
 *
 * @property {PublicKey} mint - The mint address of the token
 * @property {number} priceUsd - The price of the token in USD at the time of the swap
 * @property {bigint} amount - The amount of tokens transferred
 * @property {number} tokenDecimals - The decimals of the token
 */
type SwapTokenPrice = {
  mint: PublicKey;
  priceUsd: number;
  amount: bigint;
  tokenDecimals: number;
};

/**
 * The relevant metadata of a token at the time of a swap, grabbed from the DAS API `getAssets` endpoint.
 *
 * @property {string} name - The name of the token
 * @property {string} symbol - The symbol of the token
 * @property {string} description - The description of the token
 * @property {string} imageUri (optional) - The URI of the token's image
 * @property {string} externalUrl (optional) - The external URL of the token
 * @property {number} supply (optional) - The current supply of the token
 * @property {boolean} isPumpToken - Whether the token is a pump.fun token (metadata includes the pump.fun mint
 *   authority)
 */
export type SwapTokenMetadata = {
  name: string;
  symbol: string;
  description: string;
  imageUri?: string;
  externalUrl?: string;
  supply?: number;
  isPumpToken: boolean;
};

/* --------------------------------- PARSERS -------------------------------- */

/**
 * A transaction with both its raw transaction instruction and the parsed instruction.
 *
 * @property {TransactionInstruction} raw - The raw transaction instruction
 * @property {ParsedInstruction<Idl, string>} parsed - The instruction parsed by a custom parser
 */
export type TransactionWithParsed = {
  raw: TransactionInstruction;
  // @ts-expect-error: type difference @coral-xyz/anchor -> @project-serum/anchor
  parsed: ParsedInstruction<Idl, string>;
};

/* ----------------------------------- RPC ---------------------------------- */

/**
 * The information about a token balance.
 *
 * @property {boolean} isNative - Whether the token is native (SOL)
 * @property {string} mint - The mint address of the token
 * @property {string} owner - The owner address of the token
 * @property {string} state - The state of the token
 * @property {string} tokenAmount.amount - The amount of tokens in the token's smallest unit
 * @property {number} tokenAmount.decimals - The decimals of the token
 * @property {number} tokenAmount.uiAmount (optional) - The amount of tokens considering the decimals
 * @property {string} tokenAmount.uiAmountString (optional) - The amount of tokens considering the decimals
 */
export type ParsedTokenBalanceInfo = {
  isNative: boolean;
  mint: string;
  owner: string;
  state: string;
  tokenAmount: {
    amount: string;
    decimals: number;
    uiAmount?: number;
    uiAmountString?: string;
  };
};

/* ---------------------------------- DAS ----------------------------------- */

/**
 * The relevant info about the price of a token from the Jupiter API `/price` endpoint.
 *
 * @property {object} data - The data containing the price of the token
 */
export type GetJupiterPriceResponse = {
  data: { [id: string]: { price: number } };
};

/**
 * The full response from the DAS API `/getAssets` endpoint.
 *
 * @property {object} result - The result containing the assets
 */
export type GetAssetsResponse = {
  result: {
    interface:
      | "V1_NFT"
      | "V1_PRINT"
      | "LEGACY_NFT"
      | "V2_NFT"
      | "FungibleAsset"
      | "Custom"
      | "Identity"
      | "Executable"
      | "ProgrammableNFT";
    id: string;
    content: {
      $schema: string;
      json_uri: string;
      files: Array<{
        uri: string;
        mime: string;
        quality?: Record<string, unknown>;
        contexts?: string[];
      }>;
      metadata: {
        name: string;
        description: string;
        symbol: string;
        token_standard: string;
        attributes: Array<{
          value: string | number;
          trait_type: string;
        }>;
      };
      links?: {
        external_url?: string;
        image?: string;
      };
    };
    authorities: Array<{
      address: string;
      scopes: Array<"full" | "royalty" | "metadata" | "extension">;
    }>;
    compression?: {
      asset_hash: string;
      compressed: boolean;
      creator_hash: string;
      data_hash: string;
      eligible: boolean;
      leaf_id: number;
      seq: number;
      tree: string;
    };
    grouping: Array<{
      group_key: "collection";
      group_value: string;
    }>;
    royalty: {
      basis_points: number;
      locked: boolean;
      percent: number;
      primary_sale_happened: boolean;
      royalty_model: "creators" | "fanout" | "single";
      target: string;
    };
    creators: Array<{
      address: string;
      share: number;
      verified: boolean;
    }>;
    ownership: {
      delegate: string;
      delegated: boolean;
      frozen: boolean;
      owner: string;
      ownership_model: "single" | "token";
    };
    uses?: {
      remaining: number;
      total: number;
      use_method: "burn" | "multiple" | "single";
    };
    mutable: boolean;
    burnt: boolean;
    token_info?: {
      supply: number;
      decimals: number;
      token_program: string;
    };
  }[];
};
