import { graphql } from "./init";

export const GetTopTokensByVolumeSubscription = graphql(`
  subscription SubTopTokensByVolume {
    token_rolling_stats_30min(
      where: { token_metadata_is_pump_token: { _eq: true } }
      order_by: { total_volume_usd: desc }
      limit: 50
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

export const GetTokenPricesSinceSubscription = graphql(`
  subscription SubTokenPricesSince($token: String!, $since: timestamptz = "now()") {
    api_trade_history(
      where: { token_mint: { _eq: $token }, created_at: { _gte: $since } }
      order_by: { created_at: asc }
    ) {
      token_price_usd
      created_at
    }
  }
`);

export const GetTokenCandlesSinceSubscription = graphql(`
  subscription SubTokenCandlesSince($token: String!, $since: timestamptz = "now()") {
    token_candles_history_1min(args: { token_mint: $token, start: $since }) {
      bucket
      open_price_usd
      close_price_usd
      high_price_usd
      low_price_usd
    }
  }
`);
