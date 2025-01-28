import { Idl, utils } from "@coral-xyz/anchor";
import { ParsedInstruction } from "@shyft-to/solana-transaction-parser";
import { struct, u8 } from "@solana/buffer-layout";
// @ts-expect-error buffer-layout-utils is not typed
import { u64 } from "@solana/buffer-layout-utils";
import { AccountMeta, PublicKey, TransactionInstruction } from "@solana/web3.js";

/**
 * Arguments in the `swapBaseIn` instruction.
 *
 * @property {number} discriminator - The discriminator for the instruction (9)
 * @property {bigint} amountIn - The amount of the input token
 * @property {bigint} minimumAmountOut - The minimum amount of the output token received
 */
export type SwapBaseInArgs = {
  discriminator: number;
  amountIn: bigint;
  minimumAmountOut: bigint;
};

/** Encoding layout for the `swapBaseIn` instruction arguments. */
const SwapBaseInArgsLayout = struct<SwapBaseInArgs>([u8("discriminator"), u64("amountIn"), u64("minimumAmountOut")]);

/**
 * Arguments in the `swapBaseOut` instruction.
 *
 * @property {number} discriminator - The discriminator for the instruction (11)
 * @property {bigint} maxAmountIn - The maximum amount of the input token
 * @property {bigint} amountOut - The amount of the output token
 */
export type SwapBaseOutArgs = {
  discriminator: number;
  maxAmountIn: bigint;
  amountOut: bigint;
};

/** Encoding layout for the `swapBaseOut` instruction arguments. */
const SwapBaseOutArgsLayout = struct<SwapBaseOutArgs>([u8("discriminator"), u64("maxAmountIn"), u64("amountOut")]);

/**
 * Arguments in the `transfer` instruction (relevant to us).
 *
 * @property {bigint} amount - The amount of tokens transferred
 */
export type TransferInstruction = {
  amount: bigint;
};

/** Encoding layout for the `transfer` instruction arguments. */
const TransferInstructionLayout = struct<TransferInstruction>([u8("instruction"), u64("amount")]);

/**
 * Parses the accounts of the tokens involved in a swap.
 *
 * Note: Transactions that go directly through Raydium include the 'ammTargetOrders' account. Otherwise, if they are
 * made through Jupiter, the Raydium AMM Routing program, or various other routes, they won't include it.
 *
 * We can pretty safely infer this from the amount of accounts in the transaction (as of 2024-10-02):
 *
 * - If there are 18 accounts, it's a direct Raydium transaction;
 * - If there are 17 accounts, it's a Jupiter transaction or routed through another program.
 *
 * @param accounts - The list of accounts included in the transaction
 * @returns The parsed vaults on both ends of the swap
 * @see a similar workaround for accounts labels - https://github.com/Topledger/solana-programs/blob/main/dex-trades/src/dapps/dapp_675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8.rs
 */
const parseSwapAccounts = (accounts: AccountMeta[]): AccountMeta[] => {
  const labels = [
    "tokenProgram",
    "amm",
    "ammAuthority",
    "ammOpenOrders",
    // Figure out if this account is included depending on the amount of accounts in the transaction
    accounts.length === 18 ? "ammTargetOrders" : undefined,
    "poolCoinTokenAccount",
    "poolPcTokenAccount",
    "serumMarket",
    "serumBids",
    "serumAsks",
    "serumCoinVaultAccount",
    "serumPcVaultAccount",
    "serumVaultSigner",
    "serumReqQueue",
    "serumEventQueue",
    "userSourceTokenAccount",
    "uerDestinationTokenAccount",
    "userSourceOwner",
  ].filter(Boolean);

  return labels.map((label, index) => {
    if (!accounts[index]) throw new Error(`Account ${label} not found`);
    return { ...accounts[index], name: label };
  });
};

/**
 * Parses Raydium AMM instructions relevant to our use case (swaps).
 *
 * Note: this code is copied, stripped down to the minimum and fixed from an example provided by Shyft.
 *
 * @see original code - https://replit.com/@rex-god/get-parsed-instructions-of-raydium-amm#parsers/raydium-amm-parser.ts
 * @see blog post - https://blogs.shyft.to/how-to-stream-and-parse-raydium-transactions-with-shyfts-grpc-network-b16d5b3af249
 * @see Raydium AMM IDL - https://github.com/raydium-io/raydium-idl/blob/master/raydium_amm/src/program.ts
 */
export class RaydiumAmmParser {
  // The Raydium AMM program ID
  static PROGRAM_ID = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");
  // Discriminators for the swap instructions
  static DISCRIMINATORS = {
    swapBaseIn: 9,
    swapBaseOut: 11,
  };

  /**
   * Assigns an instruction to the correct parsing function depending on the discriminator.
   *
   * @param instruction - The transaction instruction to parse
   * @returns The parsed instruction
   */
  // @ts-expect-error: type difference @coral-xyz/anchor -> @project-serum/anchor
  parseInstruction(instruction: TransactionInstruction): ParsedInstruction<Idl, string> {
    const instructionData = instruction.data;
    const discriminator = u8().decode(instructionData);

    switch (discriminator) {
      case RaydiumAmmParser.DISCRIMINATORS.swapBaseIn: {
        return this.parseSwapBaseInIx(instruction);
      }
      case RaydiumAmmParser.DISCRIMINATORS.swapBaseOut: {
        return this.parseSwapBaseOutIx(instruction);
      }
      // We're not interested in any other instructions
      default:
        return this.parseUnknownInstruction(instruction);
    }
  }

  /**
   * Parses a `swapBaseIn` instruction.
   *
   * @param instruction - The transaction instruction to parse
   * @returns The parsed instruction
   */
  private parseSwapBaseInIx(instruction: TransactionInstruction) {
    const accounts = instruction.keys;
    const instructionData = instruction.data;
    const args = SwapBaseInArgsLayout.decode(instructionData);
    return {
      name: "swapBaseIn",
      // Retrieve the accounts relevant to the swap
      accounts: parseSwapAccounts(accounts),
      args: {
        amountIn: BigInt(args.amountIn),
        minimumAmountOut: BigInt(args.minimumAmountOut),
      },
      programId: instruction.programId,
    };
  }

  /**
   * Parses a `swapBaseOut` instruction.
   *
   * @param instruction - The transaction instruction to parse
   * @returns The parsed instruction
   */
  private parseSwapBaseOutIx(instruction: TransactionInstruction) {
    const accounts = instruction.keys;
    const instructionData = instruction.data;
    const args = SwapBaseOutArgsLayout.decode(instructionData);
    return {
      name: "swapBaseOut",
      // Retrieve the accounts relevant to the swap
      accounts: parseSwapAccounts(accounts),
      args: {
        maxAmountIn: BigInt(args.maxAmountIn),
        amountOut: BigInt(args.amountOut),
      },
      programId: instruction.programId,
    };
  }

  /**
   * Parses an unknown instruction.
   *
   * @param instruction - The transaction instruction to parse
   * @returns The parsed instruction
   */
  // @ts-expect-error: type difference @coral-xyz/anchor -> @project-serum/anchor
  private parseUnknownInstruction(instruction: TransactionInstruction): ParsedInstruction<Idl, string> {
    const accounts = instruction.keys;
    return {
      name: "Unknown",
      accounts,
      args: { unknown: utils.bytes.bs58.encode(instruction.data) },
      programId: instruction.programId,
    };
  }

  /**
   * Decodes transfer instructions.
   *
   * @param instructions - The transaction instructions to decode
   * @returns The decoded instructions
   * @custom function not in the original code
   */
  static decodeTransferIxs(...instructions: TransactionInstruction[]) {
    return instructions.map((instruction) => {
      const dataBuffer = instruction.data;
      const decoded = TransferInstructionLayout.decode(dataBuffer);

      return {
        name: "transfer",
        accounts: instruction.keys,
        args: {
          amount: BigInt(decoded.amount),
          source: instruction.keys[0]!.pubkey,
          destination: instruction.keys[1]!.pubkey,
          authority: instruction.keys[2]!.pubkey,
        },
        programId: instruction.programId,
      };
    });
  }
}
