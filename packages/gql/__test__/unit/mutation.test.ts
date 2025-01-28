import { afterEach, assert, beforeEach, describe, expect, it } from "vitest";

import { GqlClient } from "../../src/index";
import { createClientNoCache, refreshTokenRollingStats30Min, toPgComposite } from "../lib/common";
import { getRandomTokensAndTrades } from "../lib/mock";
import { seed } from "./scripts/seed";

describe("mutation tests", () => {
  let gql: GqlClient;
  let tokenMints: string[];

  beforeEach(async () => {
    gql = await createClientNoCache();
  });

  // Delete all seeded data after each test
  afterEach(async () => {
    const res = await gql.db.DeleteTradeHistoryManyMutation({ mints: Array.from(new Set(tokenMints)) });
    assert(!res.error, res.error?.message);
  });

  it("InsertTradeHistoryManyMutation", async () => {
    // Get a single random token and trade
    const { tokens, trades } = getRandomTokensAndTrades(1, new Date());
    const metadata = tokens[0];

    // Insert the trade into the database
    const res = await gql.db.InsertTradeHistoryManyMutation({
      trades: trades.map((t) => ({
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

    // Assert that the trade was inserted successfully
    assert(!res.error, res.error?.message);
    const affectedRows = res.data?.insert_api_trade_history?.affected_rows;
    expect(affectedRows).toBe(trades.length);

    // Refresh the token stats
    await refreshTokenRollingStats30Min();

    // Query the price history of this token
    const priceRes = await gql.db.GetTokenPricesSinceQuery({
      token: metadata.mint,
      since: new Date(Date.now() - 60 * 1000),
    });

    // Assert that there was some price history returned
    assert(!priceRes.error, priceRes.error?.message);
    const token = priceRes.data?.api_trade_history[0];
    assert(token, "No price returned");

    tokenMints = [metadata.mint];
  });

  it("RefreshTokenRollingStats30MinMutation", async () => {
    // Refresh the token stats
    const res = await gql.db.RefreshTokenRollingStats30MinMutation();

    // Assert that the refresh operation was successful
    assert(!res.error, res.error?.message);
    const resData = res.data?.api_refresh_token_rolling_stats_30min;
    expect(resData?.success).toBe(true);

    // Seed 100 random trades
    const { tokens } = await seed({ count: 100, from: new Date(Date.now() - 60 * 1000) });

    // Refresh the token stats again
    const res2 = await gql.db.RefreshTokenRollingStats30MinMutation();

    // Assert that the refresh operation was successful and is a different entry
    assert(!res2.error, res2.error?.message);
    const resData2 = res2.data?.api_refresh_token_rolling_stats_30min;
    expect(resData2?.success).toBe(true);
    expect(resData2?.id).not.toBe(resData?.id);

    tokenMints = tokens.map((t) => t.mint);
  });
});
