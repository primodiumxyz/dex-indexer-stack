import { graphql } from "./init";

/**
 * Subscribes to the top tokens sorted by volume during the last 30 minutes.
 *
 * @param minRecentTrades (optional, default: 0) - The minimum number of recent trades in the last minute required for a
 *   token to be included
 * @param minRecentVolume (optional, default: 0) - The minimum volume in USD in the last minute required for a token to
 *   be included
 * @param limit (optional, default: 50) - The maximum number of tokens to return
 * @returns An array of tokens:
 *
 *   - `mint` - The mint address of the token
 *   - `name` - The name of the token
 *   - `symbol` - The symbol of the token
 *   - `description` - The description of the token
 *   - `decimals` - The number of decimals of the token
 *   - `supply` (optional) - The current supply of the token
 *   - `image_uri` (optional) - The URI of the token's image
 *   - `external_url` (optional) - The external URL of the token
 *   - `is_pump_token` - Whether the token was provably created with pump.fun
 *   - `volume_usd_30m` - The volume in USD during the last 30 minutes
 *   - `trades_30m` - The number of trades during the last 30 minutes
 *   - `price_change_pct_30m` - The percentage of price change during the last 30 minutes
 *   - `volume_usd_1m` - The volume in USD during the last minute
 *   - `trades_1m` - The number of trades during the last minute
 *   - `price_change_pct_1m` - The percentage of price change during the last minute
 *   - `latest_price_usd` - The latest price in USD
 */
export const GetTopTokensByVolumeSubscription = graphql(`
  subscription SubTopTokensByVolume($minRecentTrades: numeric = 0, $minRecentVolume: numeric = 0, $limit: Int = 50) {
    token_rolling_stats_30min(
      where: {
        is_pump_token: { _eq: true }
        trades_1m: { _gte: $minRecentTrades }
        volume_usd_1m: { _gte: $minRecentVolume }
      }
      order_by: { volume_usd_30m: desc }
      limit: $limit
    ) {
      mint
      name
      symbol
      description
      decimals
      supply
      image_uri
      external_url
      is_pump_token
      volume_usd_30m
      trades_30m
      price_change_pct_30m
      volume_usd_1m
      trades_1m
      price_change_pct_1m
      latest_price_usd
    }
  }
`);

/**
 * Subscribes to the metadata and computed stats for a single token.
 *
 * @param token - The mint address of the token
 * @returns The metadata and computed stats for the token
 * @see {@link GetTopTokensByVolumeSubscription} for the return type
 */
export const GetTokenMetadataSubscription = graphql(`
  subscription SubTokenMetadata($token: String!) {
    token_rolling_stats_30min(where: { mint: { _eq: $token } }) {
      mint
      name
      symbol
      description
      decimals
      supply
      image_uri
      external_url
      is_pump_token
      volume_usd_30m
      trades_30m
      price_change_pct_30m
      volume_usd_1m
      trades_1m
      price_change_pct_1m
      latest_price_usd
    }
  }
`);

/**
 * Subscribes to the metadata and computed stats for multiple tokens.
 *
 * @param tokens - The mints of the tokens to query
 * @returns An array of tokens metadata and computed stats
 * @see {@link GetBulkTokenMetadataQuery} for the return type
 */
export const GetBulkTokenMetadataSubscription = graphql(`
  subscription SubBulkTokenMetadata($tokens: [String!]!) {
    token_rolling_stats_30min(where: { mint: { _in: $tokens } }) {
      mint
      name
      symbol
      description
      decimals
      supply
      image_uri
      external_url
      is_pump_token
      volume_usd_30m
      trades_30m
      price_change_pct_30m
      volume_usd_1m
      trades_1m
      price_change_pct_1m
      latest_price_usd
    }
  }
`);

/**
 * Subscribes to the trade history for a single token since a given time.
 *
 * @param token - The mint address of the token
 * @param since (optional, default: "now()") - The start time of the query
 * @returns An array of trade history entries:
 *
 *   - `token_price_usd` - The price of the token in USD
 *   - `volume_usd` - The volume of the trade in USD
 *   - `created_at` - The timestamp of the trade
 */
export const GetTokenPricesSinceSubscription = graphql(`
  subscription SubTokenPricesSince($token: String!, $since: timestamptz = "now()") {
    api_trade_history(
      where: { token_mint: { _eq: $token }, created_at: { _gte: $since } }
      order_by: { created_at: asc }
    ) {
      token_price_usd
      volume_usd
      created_at
    }
  }
`);

/**
 * Subscribes to the most recent trade price for a single token.
 *
 * @param token - The mint address of the token
 * @returns The most recent trade price for the token
 *
 *   - `token_price_usd` - The price of the token in USD
 *   - `created_at` - The timestamp of the trade
 */
export const GetRecentTokenPriceSubscription = graphql(`
  subscription SubRecentTokenPrice($token: String!) {
    api_trade_history(where: { token_mint: { _eq: $token } }, order_by: { created_at: desc }, limit: 1) {
      token_price_usd
      created_at
    }
  }
`);

/**
 * Subscribes to the candle history for a single token since a given time.
 *
 * @param token - The mint address of the token
 * @param since (optional, default: "now()") - The start time of the query
 * @returns An array of candle history entries:
 *
 *   - `bucket` - The 1min-bucket of the candle
 *   - `open_price_usd` - The open price of the candle in USD
 *   - `close_price_usd` - The close price of the candle in USD
 *   - `high_price_usd` - The highest price of the candle in USD
 *   - `low_price_usd` - The lowest price of the candle in USD
 *   - `volume_usd` - The volume of the candle in USD
 *   - `has_trades` - Whether the candle has any trades
 */
export const GetTokenCandlesSinceSubscription = graphql(`
  subscription SubTokenCandlesSince($token: String!, $since: timestamptz = "now()") {
    token_candles_history_1min(args: { token_mint: $token, start: $since }) {
      bucket
      open_price_usd
      close_price_usd
      high_price_usd
      low_price_usd
      volume_usd
      has_trades
    }
  }
`);
