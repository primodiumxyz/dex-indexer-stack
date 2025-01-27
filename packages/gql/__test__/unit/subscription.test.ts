import { afterEach, assert, beforeEach, describe, expect, it } from "vitest";

import { GqlClient } from "../../src/index";
import { createClientNoCache, refreshTokenRollingStats30Min, waitForSubscriptionUpdate } from "../lib/common";
import { getCandlesFromTrades, getRandomTokensAndTrades, insertTradeHistory, Token, TokenWithStats } from "../lib/mock";

describe("subscription tests", () => {
  let gql: GqlClient;
  let tokenMints: string[];

  beforeEach(async () => {
    gql = await createClientNoCache();
    await refreshTokenRollingStats30Min();
  });

  afterEach(async () => {
    const res = await gql.db.DeleteTradeHistoryManyMutation({ mints: Array.from(new Set(tokenMints)) });
    assert(!res.error, res.error?.message);
    tokenMints = [];
  });

  it("GetTopTokensByVolumeQuery", async () => {
    // Subscribe to the top tokens by volume
    let topTokens: { mint: string; volumeUsd: number }[] = [];
    const subscription = gql.db.GetTopTokensByVolumeSubscription({ limit: 10 }).subscribe((data) => {
      assert(!data.error, data.error?.message);

      topTokens =
        data.data?.token_rolling_stats_30min.map((token) => ({
          mint: token.mint,
          volumeUsd: Number(token.volume_usd_30m),
        })) ?? [];
    });

    // Get 2 random trades for different tokens & sort them by volume
    const firstTrade = getRandomTokensAndTrades(1, new Date()).trades[0];
    const secondTrade = getRandomTokensAndTrades(1, new Date()).trades[0];
    const sortedTrades = [firstTrade, secondTrade].sort((a, b) => a.volumeUsd - b.volumeUsd); // sort by lowest volume first

    // Insert the first trade (lowest volume) and refresh the view
    await insertTradeHistory(gql, [sortedTrades[0]]);
    await waitForSubscriptionUpdate(() => topTokens.length > 0);

    expect(topTokens[0].mint).toBe(sortedTrades[0].mint);
    expect(topTokens[0].volumeUsd).toBe(sortedTrades[0].volumeUsd);

    // Insert the second trade (highest volume) and refresh the view
    await insertTradeHistory(gql, [sortedTrades[1]]);
    await waitForSubscriptionUpdate(() => topTokens.length > 1);

    expect(topTokens[0].mint).toBe(sortedTrades[1].mint);
    expect(topTokens[0].volumeUsd).toBe(sortedTrades[1].volumeUsd);
    expect(topTokens[1].mint).toBe(sortedTrades[0].mint);
    expect(topTokens[1].volumeUsd).toBe(sortedTrades[0].volumeUsd);

    tokenMints = sortedTrades.map((t) => t.mint);
    subscription.unsubscribe();
  });

  it("GetTokenMetadataQuery", async () => {
    const { tokens, trades } = getRandomTokensAndTrades(1, new Date());
    const metadata = tokens[0];
    const trade = trades[0];

    // Subscribe to the token metadata
    let token: Token | undefined;
    const subscription = gql.db.GetTokenMetadataSubscription({ token: metadata.mint }).subscribe((data) => {
      assert(!data.error, data.error?.message);

      const res = data.data?.token_rolling_stats_30min[0];
      if (!res) return;

      token = {
        mint: res.mint,
        name: res.name,
        symbol: res.symbol,
        description: res.description,
        decimals: res.decimals.toString(),
        supply: Number(res.supply),
        imageUri: res.image_uri ?? "",
        externalUrl: res.external_url ?? "",
        isPumpToken: res.is_pump_token,
      };
    });

    // Insert the expected trade and refresh the view
    await insertTradeHistory(gql, [trade]);
    await waitForSubscriptionUpdate(() => !!token);

    assert(token, "token not updated");
    expect(token.mint).toBe(metadata.mint);
    expect(token.name).toBe(metadata.name);
    expect(token.symbol).toBe(metadata.symbol);
    expect(token.description).toBe(metadata.description);
    expect(token.decimals.toString()).toBe(metadata.decimals);
    expect(token.supply).toBe(metadata.supply);
    expect(token.imageUri).toBe(metadata.imageUri);
    expect(token.externalUrl).toBe(metadata.externalUrl);
    expect(token.isPumpToken).toBe(metadata.isPumpToken);

    // Update the token metadata
    const cachedToken = token;
    await insertTradeHistory(gql, [
      {
        ...trade,
        supply: 2777,
        createdAt: new Date(),
      },
    ]);
    await waitForSubscriptionUpdate(() => token !== cachedToken);

    // Token metadata should be updated, with only the supply changed
    expect(token.mint).toBe(metadata.mint);
    expect(token.name).toBe(metadata.name);
    expect(token.symbol).toBe(metadata.symbol);
    expect(token.description).toBe(metadata.description);
    expect(token.decimals).toBe(metadata.decimals);
    expect(token.supply).toBe(2777);
    expect(token.imageUri).toBe(metadata.imageUri);
    expect(token.externalUrl).toBe(metadata.externalUrl);
    expect(token.isPumpToken).toBe(metadata.isPumpToken);

    tokenMints = [metadata.mint];
    subscription.unsubscribe();
  });

  it("GetBulkTokenMetadataSubscription", async () => {
    // Create multiple random tokens and trades
    const { tokens: initialTokens, trades: initialTrades } = getRandomTokensAndTrades(3, new Date());

    // Track received tokens from subscription
    let receivedTokens: TokenWithStats[] = [];
    const subscription = gql.db
      .GetBulkTokenMetadataSubscription({
        tokens: initialTokens.map((t) => t.mint),
      })
      .subscribe((data) => {
        assert(!data.error, data.error?.message);

        receivedTokens =
          data.data?.token_rolling_stats_30min.map((token) => ({
            mint: token.mint,
            name: token.name,
            symbol: token.symbol,
            description: token.description,
            decimals: token.decimals.toString(),
            supply: Number(token.supply),
            imageUri: token.image_uri ?? "",
            externalUrl: token.external_url ?? "",
            isPumpToken: token.is_pump_token,
            volumeUsd30m: Number(token.volume_usd_30m),
            trades30m: Number(token.trades_30m),
            priceChangePct30m: Number(token.price_change_pct_30m),
            volumeUsd1m: Number(token.volume_usd_1m),
            trades1m: Number(token.trades_1m),
            priceChangePct1m: Number(token.price_change_pct_1m),
            latestPriceUsd: Number(token.latest_price_usd),
          })) ?? [];
      });

    // Insert initial trades and wait for updates
    await insertTradeHistory(gql, initialTrades);
    await waitForSubscriptionUpdate(() => receivedTokens.length > 0);

    // Verify initial state
    expect(receivedTokens.length).toBe(initialTokens.length);
    receivedTokens.sort((a, b) => a.mint.localeCompare(b.mint));
    initialTokens.sort((a, b) => a.mint.localeCompare(b.mint));

    receivedTokens.forEach((token, i) => {
      const expectedToken = initialTokens[i];
      expect(token.mint).toBe(expectedToken.mint);
      expect(token.name).toBe(expectedToken.name);
      expect(token.supply).toBe(expectedToken.supply);
      // ... other metadata checks
    });

    // Update one token's metadata
    const updatedTrade = {
      ...initialTrades[0],
      supply: 9999,
      createdAt: new Date(), // ensure newer timestamp
    };

    const cachedReceivedTokens = receivedTokens;
    await insertTradeHistory(gql, [updatedTrade]);
    await waitForSubscriptionUpdate(() => receivedTokens !== cachedReceivedTokens);

    // Find the updated token in received tokens
    const updatedToken = receivedTokens.find((t) => t.mint === initialTrades[0].mint);
    assert(updatedToken, "Updated token not found");
    expect(updatedToken.supply).toBe(9999);

    // Other tokens should remain unchanged
    receivedTokens
      .filter((t) => t.mint !== initialTrades[0].mint)
      .forEach((token) => {
        const originalToken = initialTokens.find((t) => t.mint === token.mint);
        assert(originalToken, "Original token not found");
        expect(token.supply).toBe(originalToken.supply);
      });

    tokenMints = initialTokens.map((t) => t.mint);
    subscription.unsubscribe();
  });

  it("GetTokenPricesSinceQuery", async () => {
    const { trades } = getRandomTokensAndTrades(2, new Date());
    const tokenMint = trades[0].mint;

    // Subscribe to the token prices
    let prices: { priceUsd: number; volumeUsd: number }[] = [];
    const subscription = gql.db
      .GetTokenPricesSinceSubscription({ token: tokenMint, since: new Date() })
      .subscribe((data) => {
        assert(!data.error, data.error?.message);

        const res = data.data?.api_trade_history;
        if (!res) return;

        prices = res.map((price) => ({
          priceUsd: Number(price.token_price_usd),
          volumeUsd: Number(price.volume_usd),
        }));
      });

    // Insert the first trade and refresh the view
    await insertTradeHistory(gql, [trades[0]]);
    await waitForSubscriptionUpdate(() => prices.length > 0);

    assert(prices.length > 0, "prices not updated");
    expect(prices[0].priceUsd).toBe(trades[0].priceUsd);
    expect(prices[0].volumeUsd).toBe(trades[0].volumeUsd);

    // Insert the next trade and refresh the view
    await insertTradeHistory(gql, [{ ...trades[1], mint: tokenMint, createdAt: new Date() }]);
    await waitForSubscriptionUpdate(() => prices.length > 1);

    assert(prices.length > 1, "prices not updated");
    expect(prices[0].priceUsd).toBeCloseTo(trades[0].priceUsd, 8);
    expect(prices[0].volumeUsd).toBeCloseTo(trades[0].volumeUsd, 8);
    expect(prices[1].priceUsd).toBeCloseTo(trades[1].priceUsd, 8);
    expect(prices[1].volumeUsd).toBeCloseTo(trades[1].volumeUsd, 8);

    tokenMints = [tokenMint];
    subscription.unsubscribe();
  });

  it("GetTokenCandlesSinceQuery", async () => {
    const since = new Date(Math.floor(Date.now() / 60000) * 60000);
    since.setMinutes(since.getMinutes() - 10);
    const subSince = new Date(since.getTime() - 60 * 1000);
    const { trades: _trades } = getRandomTokensAndTrades(10, since);
    const tokenMint = _trades[0].mint;
    const trades = _trades.map((t) => ({ ...t, mint: tokenMint }));

    let candles: { o: number; c: number; h: number; l: number; v: number; t: boolean; bucket: Date }[] = [];
    const subscription = gql.db
      .GetTokenCandlesSinceSubscription({ token: tokenMint, since: subSince })
      .subscribe((data) => {
        assert(!data.error, data.error?.message);

        const res = data.data?.token_candles_history_1min;
        if (!res) return;

        candles = res.map((c) => ({
          o: Number(c.open_price_usd),
          c: Number(c.close_price_usd),
          h: Number(c.high_price_usd),
          l: Number(c.low_price_usd),
          v: Number(c.volume_usd),
          t: Boolean(c.has_trades),
          bucket: new Date(c.bucket),
        }));
      });

    // Insert the first trade and refresh the view
    await insertTradeHistory(gql, [trades[0]]);
    await waitForSubscriptionUpdate(() => candles.some((c) => c.v > 0));

    // We'll have empty candles because we're subscribing to the last 20 minutes
    const candle = candles[candles.length - 1];
    assert(candle, "candle not updated");
    expect(candle.o).toBeCloseTo(trades[0].priceUsd, 8);
    expect(candle.c).toBeCloseTo(trades[0].priceUsd, 8);
    expect(candle.h).toBeCloseTo(trades[0].priceUsd, 8);
    expect(candle.l).toBeCloseTo(trades[0].priceUsd, 8);
    expect(candle.v).toBeCloseTo(trades[0].volumeUsd, 8);
    expect(candle.t).toBe(true);

    const expectedCandles = getCandlesFromTrades(trades, subSince).filter((c) => c.open_price_usd !== null);

    // Insert the rest of the trades and refresh the view
    await insertTradeHistory(gql, trades.slice(1));
    await waitForSubscriptionUpdate(() => {
      // Check that at least two expected candles with volume are present
      const expectedCandlesWithVolume = expectedCandles.filter((c) => c.volume_usd > 0);
      return candles.filter((c) => c.v > 0).length >= expectedCandlesWithVolume.length;
    });

    candles
      .sort((a, b) => b.bucket.getTime() - a.bucket.getTime())
      .forEach((candle, i) => {
        const expectedCandle = expectedCandles[i];

        expect(candle.bucket.getTime()).toBe(expectedCandle.bucket.getTime());
        expect(candle.o).toBeCloseTo(expectedCandle.open_price_usd ?? 0, 8);
        expect(candle.c).toBeCloseTo(expectedCandle.close_price_usd ?? 0, 8);
        expect(candle.h).toBeCloseTo(expectedCandle.high_price_usd ?? 0, 8);
        expect(candle.l).toBeCloseTo(expectedCandle.low_price_usd ?? 0, 8);
        expect(candle.v).toBeCloseTo(expectedCandle.volume_usd ?? 0, 8);
        expect(candle.t).toBe(expectedCandle.has_trades);
      });

    tokenMints = [tokenMint];
    subscription.unsubscribe();
  });
});
