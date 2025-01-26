import { GqlClient } from "../../src/index";
import { toPgComposite } from "./common";

export type Token = {
  mint: string;
  name: string;
  symbol: string;
  description: string;
  imageUri: string;
  externalUrl: string;
  supply: number;
  decimals: string;
  isPumpToken: boolean;
};

export type Trade = Token & {
  volumeUsd: number;
  priceUsd: number;
  createdAt: Date;
};

export type TokenWithStats = Token & {
  volumeUsd30m: number;
  trades30m: number;
  priceChangePct30m: number;
  volumeUsd1m: number;
  trades1m: number;
  priceChangePct1m: number;
  latestPriceUsd: number;
};

interface InsertMockTradeHistoryOptions {
  count: number;
  from: Date;
  batchSize?: number;
  onProgress?: (inserted: number, total: number) => void;
}

export const insertMockTradeHistory = async (
  gql: GqlClient,
  options: InsertMockTradeHistoryOptions,
): Promise<{ tokens: Token[]; trades: Trade[] }> => {
  const { count, from, batchSize = 1000, onProgress } = options;
  const tokenMintCount = Math.ceil(count * 0.05);
  const tokens: Token[] = Array.from({ length: tokenMintCount }, (_, i) => ({
    mint: getRandomMint(),
    name: `Token ${getLetterIndex(i)}`.slice(0, 255),
    symbol: `T${getLetterIndex(i)}`.slice(0, 10),
    description: `Description ${getLetterIndex(i)}`.slice(0, 255),
    imageUri: `https://example.com/image.png`,
    externalUrl: `https://example.com`,
    supply: 99999999999999,
    decimals: "6",
    isPumpToken: true,
  }));

  const trades = Array.from({ length: count }, () => {
    const token = tokens[Math.floor(Math.random() * tokens.length)];

    return {
      ...token,
      volumeUsd: getRandomVolume(),
      priceUsd: getRandomPrice(),
      createdAt: getRandomDate(from),
    };
  });

  const batches = Math.ceil(count / batchSize);
  let inserted = 0;

  for (let i = 0; i < batches; i++) {
    const res = await gql.db.InsertTradeHistoryManyMutation({
      trades: trades.slice(i * batchSize, (i + 1) * batchSize).map((t) => ({
        token_mint: t.mint,
        volume_usd: t.volumeUsd.toString(),
        token_price_usd: t.priceUsd.toString(),
        created_at: t.createdAt,
        token_metadata: toPgComposite({
          name: t.name,
          symbol: t.symbol,
          description: t.description,
          image_uri: t.imageUri,
          external_url: t.externalUrl,
          decimals: t.decimals,
          supply: t.supply,
          is_pump_token: t.isPumpToken,
        }),
      })),
    });

    if (res.error) throw new Error(res.error.message);
    const affectedRows = res.data?.insert_api_trade_history?.affected_rows;

    if (!affectedRows) throw new Error("Failed to insert mock trade history");

    inserted += affectedRows;
    onProgress?.(inserted, count);
  }

  return { tokens, trades };
};

const getRandomMint = () => {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  return Array.from({ length: 44 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
};

// between 0.000000000001 and 10 (18 decimal places)
const getRandomPrice = () => Number((Math.random() * 10 + 0.000000000001).toFixed(18));

// Returns a random number between 0.001 and 10,000 (18 decimal places)
const getRandomVolume = () => Number((Math.random() * 10000 + 0.001).toFixed(18));

// Returns a random date between from and now
const getRandomDate = (from: Date) =>
  new Date(from.getTime() + Math.random() * (new Date().getTime() - from.getTime()));

// Convert an index to an Excel-style column name (A, B, C, ..., Z, AA, AB, ..., ZZ, AAA, ...)
const getLetterIndex = (index: number): string => {
  let columnName = "";
  let num = index;

  while (num >= 0) {
    columnName = String.fromCharCode(65 + (num % 26)) + columnName;
    num = Math.floor(num / 26) - 1;
  }

  return columnName;
};
