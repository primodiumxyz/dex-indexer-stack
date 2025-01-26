import { createClientNoCache } from "../../lib/common";
import { insertMockTradeHistory, Token, TokenWithStats, Trade } from "../../lib/mock";

export const seed = async (options: {
  count: number;
  from: Date;
}): Promise<{ tokens: TokenWithStats[]; trades: Trade[] }> => {
  console.log("Starting seed process...");
  const client = await createClientNoCache();

  // Insert mock trade history
  const { tokens: _tokens, trades } = await insertMockTradeHistory(client, {
    count: options.count,
    from: options.from,
    onProgress: (inserted, total) => {
      console.log(`Seeding progress: ${((inserted / total) * 100).toFixed(2)}%`);
    },
  });

  // Give a few seconds for api.token_stats_1h to be refreshed (every 5s)
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Refresh view
  const refreshRes = await client.db.RefreshTokenRollingStats30MinMutation();
  if (refreshRes.error || !refreshRes.data?.api_refresh_token_rolling_stats_30min?.success) {
    throw new Error(`Failed to refresh token rolling stats: ${refreshRes.error?.message ?? "Unknown error"}`);
  }

  return { tokens: _tokens.map((token) => getTokenWithStats(token, trades)), trades };
};

const getTokenWithStats = (token: Token, trades: Trade[]): TokenWithStats => {
  const tokenTrades = trades
    .filter((t) => t.mint === token.mint)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  // Round these to the upper minute to consider buckets of 1m in the query (latest minute is actually the latest 1min bucket)
  const thirtyMinutesAgo = new Date(Math.ceil(Date.now() / 60000) * 60000 - 30 * 60 * 1000);
  const oneMinuteAgo = new Date(Math.ceil(Date.now() / 60000) * 60000 - 60 * 1000);

  // Get latest price
  const latestPriceUsd = tokenTrades.length > 0 ? tokenTrades[tokenTrades.length - 1].priceUsd : 0;

  // Calculate 30m stats
  const last30mTrades = tokenTrades.filter((t) => new Date(t.createdAt) >= thirtyMinutesAgo);
  const trades30m = last30mTrades.length;
  const volumeUsd30m = last30mTrades.reduce((sum, trade) => sum + trade.volumeUsd, 0);
  const priceChangePct30m =
    trades30m >= 2 ? ((latestPriceUsd - last30mTrades[0].priceUsd) / last30mTrades[0].priceUsd) * 100 : 0;

  // Calculate 1m stats (take the last minute of trades)
  const lastMinuteTrades = tokenTrades.filter((t) => new Date(t.createdAt) >= oneMinuteAgo);
  const trades1m = lastMinuteTrades.length;
  const volumeUsd1m = lastMinuteTrades.reduce((sum, trade) => sum + trade.volumeUsd, 0);
  const priceChangePct1m =
    trades1m >= 2 ? ((latestPriceUsd - lastMinuteTrades[0].priceUsd) / lastMinuteTrades[0].priceUsd) * 100 : 0;

  return {
    ...token,
    volumeUsd30m,
    trades30m,
    priceChangePct30m,
    volumeUsd1m,
    trades1m,
    priceChangePct1m,
    latestPriceUsd,
  };
};
