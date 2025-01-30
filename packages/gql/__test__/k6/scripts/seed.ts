import fs from "fs";

import { createClientNoCache } from "../../lib/common";
import { insertMockTradeHistory } from "../../lib/mock";

// Amount of trades to generate when seeding
// 900,000 trades within 30 minutes ~= 500 trades per second, which is (now) higher than the peak amount of swaps on Solana during high traffic times
const TRADES_AMOUNT = 900_000;
// Period over which trades are generated
const START_DATE = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago

/**
 * Seed the database with mock trade history.
 *
 * @returns The top 50 tokens by 30min-volume that were fetched
 */
const seed = async () => {
  console.log("Starting seed process...");
  const client = await createClientNoCache();

  // Insert mock trade history
  await insertMockTradeHistory(client, {
    count: TRADES_AMOUNT,
    from: START_DATE,
    onProgress: (inserted, total) => {
      console.log(`Seeding progress: ${((inserted / total) * 100).toFixed(2)}%`);
    },
  });

  // Refresh view
  const refreshRes = await client.db.RefreshTokenRollingStats30MinMutation();
  if (refreshRes.error || !refreshRes.data?.api_refresh_token_rolling_stats_30min?.success) {
    throw new Error(`Failed to refresh token rolling stats: ${refreshRes.error?.message ?? "Unknown error"}`);
  }

  // Get top tokens for testing
  console.log("Fetching top tokens...");
  const tokensRes = await client.db.GetTopTokensByVolumeQuery({});

  if (tokensRes.error || !tokensRes.data?.token_rolling_stats_30min.length) {
    throw new Error(`No tokens found after seeding: ${tokensRes.error?.message ?? "Unknown error"}`);
  }

  // Get the mint addresses of the top 50 tokens
  const tokens = tokensRes.data.token_rolling_stats_30min.map((t) => t.mint);
  console.log(`Found ${tokens.length} tokens for testing`);

  // Save tokens in a file for k6 tests
  const outputPath = "./__test__/k6/output/tokens.json";
  fs.writeFileSync(outputPath, JSON.stringify(tokens, null, 2));
  console.log(`Tokens saved to ${outputPath}`);

  return tokens;
};

seed()
  .then(() => {
    console.log("Mock data inserted & tokens saved");
    process.exit(0);
  })
  .catch((e) => {
    console.error("Error inserting mock data", e);
    process.exit(1);
  });
