import { utils } from "@coral-xyz/anchor";
import { IdlAccount, IdlAccountItem, IdlAccounts } from "@shyft-to/solana-transaction-parser";
import {
  AccountMeta,
  CompiledInstruction,
  LoadedAddresses,
  Message,
  MessageCompiledInstruction,
  PartiallyDecodedInstruction,
  PublicKey,
  TransactionInstruction,
  VersionedMessage,
  VersionedTransactionResponse,
} from "@solana/web3.js";

/**
 * Parse transaction message and extract account metas
 *
 * Note: Copied from [@]shyft-to/solana-tx-parser-public
 *
 * @param message Transaction message
 * @returns Parsed accounts metas
 * @see original code - https://github.com/Shyft-to/solana-tx-parser-public/blob/master/src/helpers.ts
 */
export function parseTransactionAccounts<T extends Message | VersionedMessage>(
  message: T,
  loadedAddresses: T extends VersionedMessage ? LoadedAddresses | undefined : undefined = undefined,
): AccountMeta[] {
  const accounts: PublicKey[] = message.version === "legacy" ? message.accountKeys : message.staticAccountKeys;
  const readonlySignedAccountsCount = message.header.numReadonlySignedAccounts;
  const readonlyUnsignedAccountsCount = message.header.numReadonlyUnsignedAccounts;
  const requiredSignaturesAccountsCount = message.header.numRequiredSignatures;
  const totalAccounts = accounts.length;
  let parsedAccounts: AccountMeta[] = accounts.map((account, idx) => {
    const isWritable =
      idx < requiredSignaturesAccountsCount - readonlySignedAccountsCount ||
      (idx >= requiredSignaturesAccountsCount && idx < totalAccounts - readonlyUnsignedAccountsCount);

    return {
      isSigner: idx < requiredSignaturesAccountsCount,
      isWritable,
      pubkey: new PublicKey(account),
    } as AccountMeta;
  });
  const [ALTWritable, ALTReadOnly] =
    message.version === "legacy"
      ? [[], []]
      : loadedAddresses
        ? [loadedAddresses.writable, loadedAddresses.readonly]
        : [[], []]; // message.getAccountKeys({ accountKeysFromLookups: loadedAddresses }).keySegments().slice(1); // omit static keys
  if (ALTWritable)
    parsedAccounts = [
      ...parsedAccounts,
      ...ALTWritable.map((pubkey) => ({ isSigner: false, isWritable: true, pubkey })),
    ];
  if (ALTReadOnly)
    parsedAccounts = [
      ...parsedAccounts,
      ...ALTReadOnly.map((pubkey) => ({ isSigner: false, isWritable: false, pubkey })),
    ];

  return parsedAccounts;
}

/**
 * Converts compiled instruction into common TransactionInstruction
 *
 * Note: Copied from [@]shyft-to/solana-tx-parser-public
 *
 * @param compiledInstruction
 * @param parsedAccounts Account meta, result of {@link parseTransactionAccounts}
 * @returns TransactionInstruction
 * @see original code - https://github.com/Shyft-to/solana-tx-parser-public/blob/master/src/helpers.ts
 */
export function compiledInstructionToInstruction<Ix extends CompiledInstruction | MessageCompiledInstruction>(
  compiledInstruction: Ix,
  parsedAccounts: AccountMeta[],
): TransactionInstruction {
  if (typeof compiledInstruction.data === "string") {
    const ci = compiledInstruction as CompiledInstruction;
    if (parsedAccounts[ci.programIdIndex] === undefined)
      throw new Error(`Program ID index ${ci.programIdIndex} not found in parsed accounts`);

    return new TransactionInstruction({
      data: utils.bytes.bs58.decode(ci.data),
      programId: parsedAccounts[ci.programIdIndex]!.pubkey,
      keys: ci.accounts.map((accountIdx) => parsedAccounts[accountIdx]).filter((acc) => acc !== undefined),
    });
  } else {
    const ci = compiledInstruction as MessageCompiledInstruction;
    if (!parsedAccounts[ci.programIdIndex])
      throw new Error(`Program ID index ${ci.programIdIndex} not found in parsed accounts`);

    return new TransactionInstruction({
      data: Buffer.from(ci.data),
      programId: parsedAccounts[ci.programIdIndex]!.pubkey,
      keys: ci.accountKeyIndexes.map((accountIndex) => {
        if (accountIndex >= parsedAccounts.length)
          throw new Error(
            `Trying to resolve account at index ${accountIndex} while parsedAccounts is only ${parsedAccounts.length}. \
						Looks like you're trying to parse versioned transaction, make sure that LoadedAddresses are passed to the \
						parseTransactionAccounts function`,
          );

        if (parsedAccounts[accountIndex] === undefined)
          throw new Error(`Account at index ${accountIndex} not found in parsed accounts`);
        return parsedAccounts[accountIndex];
      }),
    });
  }
}

/**
 * Converts parsed accounts to account meta
 *
 * Note: Copied from [@]shyft-to/solana-tx-parser-public
 *
 * @param accounts Parsed accounts
 * @param accountMeta Account meta
 * @returns Account meta
 * @see original code - https://github.com/Shyft-to/solana-tx-parser-public/blob/master/src/helpers.ts
 */
function parsedAccountsToMeta(accounts: PublicKey[], accountMeta: AccountMeta[]): AccountMeta[] {
  const meta = accountMeta.map((m) => ({ pk: m.pubkey.toString(), ...m }));

  return accounts.map((account) => {
    const encoded = account.toString();
    const found = meta.find((item) => item.pk === encoded);
    if (!found) throw new Error(`Account ${encoded} not present in account meta!`);

    return found;
  });
}

/**
 * Converts partially decoded instruction to instruction
 *
 * Note: Copied from [@]shyft-to/solana-tx-parser-public
 *
 * @param parsedInstruction Parsed instruction
 * @param accountMeta Account meta
 * @returns Instruction
 * @see original code - https://github.com/Shyft-to/solana-tx-parser-public/blob/master/src/helpers.ts
 */
export function parsedInstructionToInstruction(
  parsedInstruction: PartiallyDecodedInstruction,
  accountMeta: AccountMeta[],
): TransactionInstruction {
  return new TransactionInstruction({
    data: utils.bytes.bs58.decode(parsedInstruction.data),
    programId: parsedInstruction.programId,
    keys: parsedAccountsToMeta(parsedInstruction.accounts, accountMeta),
  });
}

/**
 * Converts transaction response with CPI into artifical transaction that contains all instructions from tx and CPI
 *
 * Note: Copied from [@]shyft-to/solana-tx-parser-public
 *
 * @param transaction TransactionResponse to convert from
 * @returns Transaction object
 * @see original code - https://github.com/Shyft-to/solana-tx-parser-public/blob/master/src/helpers.ts
 */
export function flattenTransactionResponse(
  transaction: VersionedTransactionResponse,
): (TransactionInstruction & { parentProgramId?: PublicKey })[] {
  const result: (TransactionInstruction & { parentProgramId?: PublicKey })[] = [];
  if (transaction === null || transaction === undefined) return [];
  const txInstructions = transaction.transaction.message.compiledInstructions;
  const accountsMeta = parseTransactionAccounts(transaction.transaction.message, transaction.meta?.loadedAddresses);
  const orderedCII = (transaction?.meta?.innerInstructions || []).sort((a, b) => a.index - b.index);
  const totalCalls =
    (transaction.meta?.innerInstructions || []).reduce((accumulator, cii) => accumulator + cii.instructions.length, 0) +
    txInstructions.length;
  let lastPushedIx = -1;
  let callIndex = -1;
  for (const CII of orderedCII) {
    // push original instructions until we meet CPI
    while (lastPushedIx !== CII.index) {
      lastPushedIx += 1;
      callIndex += 1;
      const instruction = txInstructions[lastPushedIx];
      if (!instruction) continue;
      result.push(compiledInstructionToInstruction(instruction, accountsMeta));
    }
    for (const CIIEntry of CII.instructions) {
      const instruction = txInstructions[lastPushedIx];
      if (!instruction) continue;
      const parentProgramId = accountsMeta[instruction.programIdIndex]?.pubkey;
      result.push({
        ...compiledInstructionToInstruction(CIIEntry, accountsMeta),
        parentProgramId,
      });
      callIndex += 1;
    }
  }
  while (callIndex < totalCalls - 1) {
    lastPushedIx += 1;
    callIndex += 1;
    const instruction = txInstructions[lastPushedIx];
    if (!instruction) continue;
    result.push(compiledInstructionToInstruction(txInstructions[lastPushedIx]!, accountsMeta));
  }

  return result;
}

/**
 * Flattens the IdlAccountItem array into an IdlAccount array
 *
 * Note: Copied from [@]shyft-to/solana-tx-parser-public
 *
 * @param accounts IdlAccountItem array
 * @param prefix (optional) Prefix for the account name
 * @returns IdlAccount array
 * @see original code - https://github.com/Shyft-to/solana-tx-parser-public/blob/master/src/helpers.ts
 */
export function flattenIdlAccounts(accounts: IdlAccountItem[], prefix?: string): IdlAccount[] {
  return accounts
    .map((account) => {
      const accName = account.name;
      if (Object.prototype.hasOwnProperty.call(account, "accounts")) {
        const newPrefix = prefix ? `${prefix} > ${accName}` : accName;

        return flattenIdlAccounts((<IdlAccounts>account).accounts, newPrefix);
      } else {
        return {
          ...(<IdlAccount>account),
          name: prefix ? `${prefix} > ${accName}` : accName,
        };
      }
    })
    .flat();
}
