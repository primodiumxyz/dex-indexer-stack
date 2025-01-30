/**
 * A token with its metadata and trading stats
 *
 * @property mint - The mint address of the token
 * @property name - The name of the token
 * @property symbol - The symbol of the token
 * @property imageUri (optional) - The URI of the token's image
 * @property volumeUsd - The volume of the token in USD during the last 30 minutes
 * @property priceChangePct - The price change percentage of the token during the last 30 minutes
 * @property tradeCount - The number of trades of the token during the last 30 minutes
 * @property latestPriceUsd - The latest price of the token in USD
 * @property supply - The supply of the token
 */
export type Token = {
  mint: string;
  name: string;
  symbol: string;
  imageUri?: string;
  volumeUsd: number;
  priceChangePct: number;
  tradeCount: number;
  latestPriceUsd: number;
  supply: number;
};

/**
 * A price point for a token (when a trade happened)
 *
 * @property timestamp - The timestamp of the trade
 * @property price - The new price of the token in USD after the trade
 */
export type TokenPrice = {
  timestamp: number;
  price: number;
};
