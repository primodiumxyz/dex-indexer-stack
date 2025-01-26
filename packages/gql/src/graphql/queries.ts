import { graphql } from "./init";

export const GetAllTokensQuery = graphql(`
  query GetAllTokens {
    token_rolling_stats_30min {
      mint
    }
  }
`);

export const GetTopTokensByVolumeQuery = graphql(`
  query GetTopTokensByVolumeQuery($minRecentTrades: numeric = 0, $minRecentVolume: numeric = 0, $limit: Int = 50) {
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

export const GetTokenMetadataQuery = graphql(`
  query GetTokenMetadataQuery($token: String!) {
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

export const GetBulkTokenMetadataQuery = graphql(`
  query GetBulkTokenMetadataQuery($tokens: [String!]!) {
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

export const GetTokenPricesSinceQuery = graphql(`
  query GetTokenPricesSinceQuery($token: String!, $since: timestamptz = "now()") {
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

export const GetTokenCandlesSinceQuery = graphql(`
  query GetTokenCandlesSinceQuery($token: String!, $since: timestamptz = "now()") {
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
