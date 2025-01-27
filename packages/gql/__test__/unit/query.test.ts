import { afterAll, assert, beforeAll, describe, expect, it } from "vitest";

import { GqlClient } from "../../src/index";
import { createClientNoCache } from "../lib/common";
import { getCandlesFromTrades, TokenWithStats, Trade } from "../lib/mock";
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
    assert(!res.error, res.error?.message);
  });

  it("GetTopTokensByVolumeQuery", async () => {
    // Get the top 10 tokens by volume
    const res = await gql.db.GetTopTokensByVolumeQuery({ limit: 10 });
    assert(!res.error, res.error?.message);
    const topTokens = res.data?.token_rolling_stats_30min;
    assert(topTokens, "No top tokens returned");

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
    const expectedToken = tokens[0];
    const res = await gql.db.GetTokenMetadataQuery({ token: expectedToken.mint });
    assert(!res.error, res.error?.message);

    const token = res.data?.token_rolling_stats_30min[0];
    assert(token, "No token returned");

    expect(token.mint).toBe(expectedToken.mint);
    expect(token.name).toBe(expectedToken.name);
    expect(token.symbol).toBe(expectedToken.symbol);
    expect(token.description).toBe(expectedToken.description);
    expect(token.decimals.toString()).toBe(expectedToken.decimals);
    expect(token.supply).toBe(expectedToken.supply);
    expect(token.image_uri).toBe(expectedToken.imageUri);
    expect(token.external_url).toBe(expectedToken.externalUrl);
    expect(token.is_pump_token).toBe(expectedToken.isPumpToken);

    expect(token.volume_usd_30m).toBeCloseTo(expectedToken.volumeUsd30m, 8);
    expect(token.trades_30m).toBeCloseTo(expectedToken.trades30m, 8);
    expect(token.price_change_pct_30m).toBeCloseTo(expectedToken.priceChangePct30m, 8);
    expect(token.volume_usd_1m).toBeCloseTo(expectedToken.volumeUsd1m, 8);
    expect(token.trades_1m).toBeCloseTo(expectedToken.trades1m, 8);
    expect(token.price_change_pct_1m).toBeCloseTo(expectedToken.priceChangePct1m, 8);
    expect(token.latest_price_usd).toBeCloseTo(expectedToken.latestPriceUsd, 8);
  });

  it("GetBulkTokenMetadataQuery", async () => {
    const res = await gql.db.GetBulkTokenMetadataQuery({
      tokens: tokens.sort((a, b) => a.mint.localeCompare(b.mint)).map((t) => t.mint),
    });
    assert(!res.error, res.error?.message);

    const tokensRes = res.data?.token_rolling_stats_30min;
    assert(tokensRes, "No tokens returned");

    tokensRes
      .sort((a, b) => a.mint.localeCompare(b.mint))
      .forEach((token, i) => {
        const expectedToken = tokens[i];
        expect(token.mint).toBe(expectedToken.mint);
        expect(token.name).toBe(expectedToken.name);
        expect(token.symbol).toBe(expectedToken.symbol);
        expect(token.description).toBe(expectedToken.description);
        expect(token.decimals.toString()).toBe(expectedToken.decimals);
        expect(token.supply).toBe(expectedToken.supply);
        expect(token.image_uri).toBe(expectedToken.imageUri);
        expect(token.external_url).toBe(expectedToken.externalUrl);
        expect(token.is_pump_token).toBe(expectedToken.isPumpToken);

        expect(token.volume_usd_30m).toBeCloseTo(expectedToken.volumeUsd30m, 8);
        expect(token.trades_30m).toBeCloseTo(expectedToken.trades30m, 8);
        expect(token.price_change_pct_30m).toBeCloseTo(expectedToken.priceChangePct30m, 8);
        expect(token.volume_usd_1m).toBeCloseTo(expectedToken.volumeUsd1m, 8);
        expect(token.trades_1m).toBeCloseTo(expectedToken.trades1m, 8);
        expect(token.price_change_pct_1m).toBeCloseTo(expectedToken.priceChangePct1m, 8);
        expect(token.latest_price_usd).toBeCloseTo(expectedToken.latestPriceUsd, 8);
      });
  });

  it("GetTokenPricesSinceQuery", async () => {
    tokens.slice(0, 10).forEach(async (token) => {
      const expectedPrices = trades
        .filter((t) => t.mint === token.mint)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .filter((t) => t.createdAt >= new Date(Date.now() - 10 * 60 * 1000));

      const res = await gql.db.GetTokenPricesSinceQuery({
        token: token.mint,
        since: new Date(Date.now() - 10 * 60 * 1000),
      });
      assert(!res.error, res.error?.message);

      const prices = res.data?.api_trade_history;
      assert(prices, "No prices returned");

      prices.forEach((price, i) => {
        expect(price.token_price_usd).toBeCloseTo(expectedPrices[i].priceUsd, 8);
      });
    });
  });

  it("GetTokenCandlesSinceQuery", async () => {
    tokens.slice(0, 10).forEach(async (token) => {
      const since = new Date(Math.floor(Date.now() / 60000) * 60000);
      since.setMinutes(since.getMinutes() - 10);

      // Get trades for this token in the last 10 minutes
      const tokenTrades = trades
        .filter((t) => t.mint === token.mint)
        .filter((t) => t.createdAt >= since)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      const res = await gql.db.GetTokenCandlesSinceQuery({
        token: token.mint,
        since,
      });
      assert(!res.error, res.error?.message);

      const candles = res.data?.token_candles_history_1min;
      if (!candles) throw new Error("No candles returned");

      const expectedCandles = getCandlesFromTrades(tokenTrades, since);
      const sortedCandles = candles.sort((a, b) => new Date(b.bucket).getTime() - new Date(a.bucket).getTime());

      sortedCandles.forEach((candle, i) => {
        const expectedCandle = expectedCandles[i];
        expect(new Date(candle.bucket).getTime()).toBe(expectedCandle.bucket.getTime());
        expect(candle.open_price_usd).toBeCloseTo(expectedCandle.open_price_usd ?? 0, 8);
        expect(candle.close_price_usd).toBeCloseTo(expectedCandle.close_price_usd ?? 0, 8);
        expect(candle.high_price_usd).toBeCloseTo(expectedCandle.high_price_usd ?? 0, 8);
        expect(candle.low_price_usd).toBeCloseTo(expectedCandle.low_price_usd ?? 0, 8);
        expect(candle.volume_usd).toBeCloseTo(expectedCandle.volume_usd, 8);
        expect(candle.has_trades).toBe(expectedCandle.has_trades);
      });
    });
  });
});
