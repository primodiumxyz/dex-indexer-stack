import { graphql } from "./init";

export const InsertTradeHistoryManyMutation = graphql(`
  mutation InsertTradeHistoryMany($trades: [api_trade_history_insert_input!]!) {
    insert_api_trade_history(objects: $trades) {
      affected_rows
    }
  }
`);

export const DeleteTradeHistoryManyMutation = graphql(`
  mutation DeleteTradeHistoryMany($mints: [String!]!) {
    delete_api_trade_history(where: { token_mint: { _in: $mints } }) {
      affected_rows
    }
  }
`);

export const RefreshTokenRollingStats30MinMutation = graphql(`
  mutation RefreshTokenRollingStats30Min {
    api_refresh_token_rolling_stats_30min {
      id
      success
    }
  }
`);
