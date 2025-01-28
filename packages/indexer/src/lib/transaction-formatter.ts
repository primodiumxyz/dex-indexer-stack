import { utils } from "@coral-xyz/anchor";
import {
  ConfirmedTransactionMeta,
  Message,
  MessageV0,
  PublicKey,
  TokenBalance,
  VersionedMessage,
  VersionedTransactionResponse,
} from "@solana/web3.js";
import { SubscribeUpdateTransaction } from "@triton-one/yellowstone-grpc";
import {
  TokenBalance as TokenBalanceGrpc,
  Transaction,
  TransactionStatusMeta,
} from "@triton-one/yellowstone-grpc/dist/grpc/solana-storage";

/**
 * Formats a raw transaction update from the stream into an understandable and parsable JSON object.
 *
 * Note: this code is copied, fixed and typed from an example provided by Shyft.
 *
 * @see original code - https://replit.com/@rex-god/get-parsed-instructions-of-raydium-amm#parsers/raydium-amm-parser.ts
 * @see blog post - https://blogs.shyft.to/how-to-stream-and-parse-raydium-transactions-with-shyfts-grpc-network-b16d5b3af249
 */
export class TransactionFormatter {
  /**
   * Main function for formatting a raw transaction update from the stream into an understandable and parsable JSON
   * object.
   *
   * @param data - The raw {@link SubscribeUpdateTransaction} object from the Yellowstone GRPC stream
   * @param time - The current time
   * @returns The formatted {@link VersionedTransactionResponse} object
   */
  public formTransactionFromJson(
    data: SubscribeUpdateTransaction,
    time: number,
  ): VersionedTransactionResponse | undefined {
    const rawTx = data["transaction"];

    const slot = data.slot;
    const version = rawTx?.transaction?.message?.versioned ? 0 : "legacy";

    // Form the meta object
    const meta = this.formMeta(rawTx?.meta);
    if (!meta) return;

    // Form the signatures array
    const signatures = rawTx?.transaction?.signatures.map((s: Uint8Array) => utils.bytes.bs58.encode(s));

    // Form the message object
    const message = this.formTxnMessage(rawTx?.transaction?.message);
    if (!message) return;

    // Return the fully formatted transaction object
    return {
      slot: Number(slot),
      version,
      blockTime: time,
      meta,
      transaction: {
        signatures: signatures ?? [],
        message,
      },
    };
  }

  /**
   * Formats the message object from the raw transaction update.
   *
   * This will unify the message object into a single format, regardless of the transaction version.
   *
   * @param message - The raw transaction message
   * @returns The formatted {@link VersionedMessage} object
   */
  private formTxnMessage(message: Transaction["message"]): VersionedMessage | undefined {
    if (!message) return;
    if (!message.versioned) {
      return new Message({
        header: {
          numRequiredSignatures: message.header?.numRequiredSignatures ?? 0,
          numReadonlySignedAccounts: message.header?.numReadonlySignedAccounts ?? 0,
          numReadonlyUnsignedAccounts: message.header?.numReadonlyUnsignedAccounts ?? 0,
        },
        recentBlockhash: utils.bytes.bs58.encode(message.recentBlockhash),
        accountKeys: message.accountKeys?.map((d: Uint8Array) => utils.bytes.bs58.encode(d)),
        instructions: message.instructions.map(
          ({ data, programIdIndex, accounts }: { data: Uint8Array; programIdIndex: number; accounts: Uint8Array }) => ({
            programIdIndex: programIdIndex,
            accounts: [...accounts],
            data: utils.bytes.bs58.encode(data),
          }),
        ),
      });
    } else {
      return new MessageV0({
        header: {
          numRequiredSignatures: message.header?.numRequiredSignatures ?? 0,
          numReadonlySignedAccounts: message.header?.numReadonlySignedAccounts ?? 0,
          numReadonlyUnsignedAccounts: message.header?.numReadonlyUnsignedAccounts ?? 0,
        },
        recentBlockhash: utils.bytes.bs58.encode(message.recentBlockhash),
        staticAccountKeys: message.accountKeys.map((k: Uint8Array) => new PublicKey(utils.bytes.bs58.encode(k))),
        compiledInstructions: message.instructions.map(
          ({ programIdIndex, accounts, data }: { programIdIndex: number; accounts: Uint8Array; data: Uint8Array }) => ({
            programIdIndex: programIdIndex,
            accountKeyIndexes: [...accounts],
            data: data,
          }),
        ),
        addressTableLookups:
          message.addressTableLookups?.map(({ accountKey, writableIndexes, readonlyIndexes }) => ({
            writableIndexes: [...writableIndexes],
            readonlyIndexes: [...readonlyIndexes],
            accountKey: new PublicKey(utils.bytes.bs58.encode(accountKey)),
          })) || [],
      });
    }
  }

  /**
   * Formats the meta object from the raw transaction update.
   *
   * @param meta - The raw transaction meta
   * @returns The formatted {@link ConfirmedTransactionMeta} object
   */
  private formMeta(meta: TransactionStatusMeta | undefined): ConfirmedTransactionMeta | undefined {
    if (!meta) return;
    return {
      err: meta.err ?? null,
      fee: Number(meta.fee),
      preBalances: meta.preBalances.map(Number),
      postBalances: meta.postBalances.map(Number),
      preTokenBalances: meta.preTokenBalances.map(this.formTokenBalance),
      postTokenBalances: meta.postTokenBalances.map(this.formTokenBalance),
      logMessages: meta.logMessages || [],
      loadedAddresses:
        meta.loadedWritableAddresses || meta.loadedReadonlyAddresses
          ? {
              writable:
                meta.loadedWritableAddresses?.map((address) => new PublicKey(utils.bytes.bs58.encode(address))) || [],
              readonly:
                meta.loadedReadonlyAddresses?.map((address) => new PublicKey(utils.bytes.bs58.encode(address))) || [],
            }
          : undefined,
      innerInstructions:
        meta.innerInstructions?.map((i) => ({
          index: i.index || 0,
          instructions: i.instructions.map((instruction) => ({
            programIdIndex: instruction.programIdIndex,
            accounts: [...instruction.accounts],
            data: utils.bytes.bs58.encode(instruction.data),
          })),
        })) || [],
    };
  }

  /**
   * Formats the token balance object from the raw transaction update.
   *
   * @param balance - The raw {@link TokenBalanceGrpc} object
   * @returns The formatted {@link TokenBalance} object
   */
  private formTokenBalance(balance: TokenBalanceGrpc): TokenBalance {
    return {
      ...balance,
      uiTokenAmount: balance.uiTokenAmount ?? {
        amount: "0",
        decimals: 0,
        uiAmount: 0,
      },
    };
  }
}
