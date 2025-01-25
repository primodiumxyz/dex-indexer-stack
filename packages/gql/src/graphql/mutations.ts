import { graphql } from "./init";

// Indexer
export const InsertTradeHistoryManyMutation = graphql(`
  mutation InsertTradeHistoryMany($trades: [api_trade_history_insert_input!]!) {
    insert_api_trade_history(objects: $trades) {
      affected_rows
    }
  }
`);

// Server
export const RefreshTokenRollingStats30MinMutation = graphql(`
  mutation RefreshTokenRollingStats30Min {
    api_refresh_token_rolling_stats_30min {
      id
      success
    }
  }
`);
