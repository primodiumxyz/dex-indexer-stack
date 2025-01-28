import { graphql } from "./init";

/**
 * Inserts multiple trade history entries into the Timescale database.
 *
 * @param trades - The trade history objects to insert
 * @returns The number of affected rows
 */
export const InsertTradeHistoryManyMutation = graphql(`
  mutation InsertTradeHistoryMany($trades: [api_trade_history_insert_input!]!) {
    insert_api_trade_history(objects: $trades) {
      affected_rows
    }
  }
`);

/**
 * Deletes multiple trade history entries from the Timescale database.
 *
 * @param mints - The mints of the trade history entries to delete (`token_mint` column)
 * @returns The number of affected rows
 */
export const DeleteTradeHistoryManyMutation = graphql(`
  mutation DeleteTradeHistoryMany($mints: [String!]!) {
    delete_api_trade_history(where: { token_mint: { _in: $mints } }) {
      affected_rows
    }
  }
`);

/**
 * Refreshes the 30-minute rolling stats for all tokens.
 *
 * This should be called periodically from a cron job, or any other scheduled job. This is a way to lift the expensive
 * computation of the rolling stats out of the hot path (user-initiated requests), and into a background job.
 *
 * @returns The number of affected rows
 */
export const RefreshTokenRollingStats30MinMutation = graphql(`
  mutation RefreshTokenRollingStats30Min {
    api_refresh_token_rolling_stats_30min {
      id
      success
    }
  }
`);
