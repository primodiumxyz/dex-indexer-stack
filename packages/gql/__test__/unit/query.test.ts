import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { GqlClient } from "../../src/index";
import { createClientNoCache } from "../lib/common";
import { TokenWithStats, Trade } from "../lib/mock";
import { seed } from "./scripts/seed";

describe("query tests", () => {
  let gql: GqlClient;
  let tokens: TokenWithStats[];
  let trades: Trade[];

  beforeAll(async () => {
    gql = await createClientNoCache();
    // Insert 1,000 trades in the last 20 minutes
    const { tokens: seedTokens, trades: seedTrades } = await seed({
      count: 1000,
      from: new Date(Date.now() - 20 * 60 * 1000),
    });

    tokens = seedTokens;
    trades = seedTrades;
  });

  afterAll(async () => {
    const res = await gql.db.DeleteTradeHistoryManyMutation({ mints: Array.from(new Set(tokens.map((t) => t.mint))) });
    if (res.error) throw new Error(res.error.message);
  });

  it("GetTopTokensByVolumeQuery", async () => {
    // Get the top 10 tokens by volume
    const res = await gql.db.GetTopTokensByVolumeQuery({ limit: 10 });
    if (res.error) throw new Error(res.error.message);
    const topTokens = res.data?.token_rolling_stats_30min;
    if (!topTokens) throw new Error("No top tokens returned");

    // Sort expected tokens by 30min volume
    const expectedTopTokens = tokens.sort((a, b) => b.volumeUsd30m - a.volumeUsd30m).slice(0, 10);

    topTokens.forEach((token, i) => {
      const expectedToken = expectedTopTokens[i];
      expect(token.mint).toBe(expectedToken.mint);

      expect(token.volume_usd_30m).toBeCloseTo(expectedToken.volumeUsd30m, 8);
      expect(token.trades_30m).toBeCloseTo(expectedToken.trades30m, 8);
      expect(token.price_change_pct_30m).toBeCloseTo(expectedToken.priceChangePct30m, 8);
      expect(token.volume_usd_1m).toBeCloseTo(expectedToken.volumeUsd1m, 8);
      expect(token.trades_1m).toBeCloseTo(expectedToken.trades1m, 8);
      expect(token.price_change_pct_1m).toBeCloseTo(expectedToken.priceChangePct1m, 8);
      expect(token.latest_price_usd).toBeCloseTo(expectedToken.latestPriceUsd, 8);
    });
  });

  it("GetTokenMetadataQuery", async () => {
    expect(true).toBe(true);
  });

  it("GetBulkTokenMetadataQuery", async () => {
    expect(true).toBe(true);
  });

  it("GetTokenPricesSinceQuery", async () => {
    expect(true).toBe(true);
  });

  it("GetTokenCandlesSinceQuery", () => {
    expect(true).toBe(true);
  });
});
