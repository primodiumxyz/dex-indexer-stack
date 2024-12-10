import { Connection, PublicKey, TransactionInstruction, AddressLookupTableAccount } from "@solana/web3.js";
import { DefaultApi, QuoteGetRequest, SwapInstructionsPostRequest } from "@jup-ag/api";

export type JupiterSettings = {
  connection: Connection;
  jupiterQuoteApi: DefaultApi;
};

interface JupiterInstruction {
  programId: string;
  accounts: Array<{
    pubkey: string;
    isSigner: boolean;
    isWritable: boolean;
  }>;
  data: string;
}

/**
 * Service for interacting with Jupiter API
 */
export class JupiterService {
  /**
   * Creates a new instance of JupiterService
   * @param connection - Solana RPC connection
   * @param jupiterQuoteApi - Jupiter API client
   */
  constructor(
    private connection: Connection,
    private jupiterQuoteApi: DefaultApi,
  ) {}

  getSettings(): JupiterSettings {
    return {
      connection: this.connection,
      jupiterQuoteApi: this.jupiterQuoteApi,
    };
  }

  /**
   * Gets a quote for a token swap from Jupiter
   * @param params - Quote request parameters
   * @returns Quote response from Jupiter
   * @throws Error if quote cannot be obtained
   */
  async getQuote(params: QuoteGetRequest) {
    try {
      const quote = await this.jupiterQuoteApi.quoteGet(params);
      if (!quote) {
        throw new Error("unable to quote");
      }

      console.log(`[getQuote] Successfully received quote`);
      return quote;
    } catch (error) {
      console.error("[getQuote] Error getting quote:", error);
      throw new Error(`Failed to get quote: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private deserializeInstruction(instruction: JupiterInstruction): TransactionInstruction {
    return new TransactionInstruction({
      programId: new PublicKey(instruction.programId),
      keys: instruction.accounts.map((account) => ({
        pubkey: new PublicKey(account.pubkey),
        isSigner: account.isSigner,
        isWritable: account.isWritable,
      })),
      data: Buffer.from(instruction.data, "base64"),
    });
  }

  /**
   * Gets swap instructions for a quoted trade
   * @param quoteAndSwapParams - Parameters for quote and swap
   * @param userPublicKey - User's public key
   * @returns Swap instructions from Jupiter
   */
  async getSwapInstructions(
    quoteAndSwapParams: QuoteGetRequest,
    userPublicKey: PublicKey,
  ): Promise<{
    instructions: TransactionInstruction[];
    addressLookupTableAccounts: AddressLookupTableAccount[];
  }> {
    try {
      const quote = await this.getQuote(quoteAndSwapParams);

      const swapInstructionsRequest: SwapInstructionsPostRequest = {
        swapRequest: {
          quoteResponse: quote,
          userPublicKey: userPublicKey.toBase58(),
          asLegacyTransaction: quoteAndSwapParams.asLegacyTransaction,
          wrapAndUnwrapSol: true,
          prioritizationFeeLamports: { autoMultiplier: 3 },
        },
      };

      const swapInstructions = await this.jupiterQuoteApi.swapInstructionsPost(swapInstructionsRequest);
      if (!swapInstructions) {
        throw new Error("No swap instructions received");
      }

      const addressLookupTableAccounts = await Promise.all(
        (swapInstructions.addressLookupTableAddresses || []).map(async (address) => {
          const account = await this.connection.getAddressLookupTable(new PublicKey(address));
          if (!account?.value) {
            throw new Error(`Could not fetch address lookup table account ${address}`);
          }
          return account.value;
        }),
      );

      // Combine all instructions in the correct order
      const allInstructions: TransactionInstruction[] = [
        ...(swapInstructions.computeBudgetInstructions || []).map(this.deserializeInstruction),
        ...(swapInstructions.setupInstructions || []).map(this.deserializeInstruction),
        swapInstructions.swapInstruction ? this.deserializeInstruction(swapInstructions.swapInstruction) : [],
        ...(swapInstructions.cleanupInstruction
          ? [this.deserializeInstruction(swapInstructions.cleanupInstruction)]
          : []),
      ].flat();

      return {
        instructions: allInstructions,
        addressLookupTableAccounts,
      };
    } catch (error) {
      console.error("[getSwapInstructions] Error getting swap instructions:", error);
      throw new Error(`Failed to get swap instructions: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}
