import { afterAll, beforeAll, describe, it } from "vitest";
import { benchmark, BenchmarkMetrics, logMetrics, writeMetricsToFile } from "../lib/benchmarks";
import { clearCache, createClientCacheBypass, createClientCached, createClientNoCache } from "../lib/common";
import { ITERATIONS } from "./config";

describe("GetTokenLiveData benchmarks", () => {
  let tokens: string[] = [];
  const metrics: BenchmarkMetrics[] = [];

  beforeAll(async () => {
    const client = await createClientNoCache();

    const refreshRes = await client.db.RefreshTokenRollingStats30MinMutation();
    if (refreshRes.error || !refreshRes.data?.api_refresh_token_rolling_stats_30min?.success)
      throw new Error("Error refreshing token rolling stats");

    const allTokensRes = await client.db.GetAllTokensQuery();
    if (allTokensRes.error || !allTokensRes.data?.api_token_rolling_stats_30min) throw new Error("No tokens found");
    tokens = allTokensRes.data?.api_token_rolling_stats_30min.map((t) => t.mint).filter((t) => t !== null) || [];
  });

  it("should measure direct Hasura performance", async () => {
    const metric = await benchmark<"GetTokenLiveDataQuery">({
      identifier: "Direct Hasura hit",
      exec: async (i) => {
        const client = await createClientNoCache();
        return await client.db.GetTokenLiveDataQuery({
          token: tokens[i],
        });
      },
      iterations: ITERATIONS,
      after: (res) => {
        if (res.error || res.data?.api_token_rolling_stats_30min.length === 0)
          throw new Error("Error or no tokens found");
      },
    });

    metrics.push({ ...metric, group: "A" });
  });

  it("should measure warm cache performance", async () => {
    // Cache warmup
    for (let i = 0; i < ITERATIONS; i++) {
      const client = await createClientCached();
      await client.db.GetTokenLiveDataQuery({
        token: tokens[i],
      });
    }

    const metric = await benchmark<"GetTokenLiveDataQuery">({
      identifier: "Warm cache hit",
      exec: async (i) => {
        const client = await createClientCached();

        return await client.db.GetTokenLiveDataQuery({
          token: tokens[i],
        });
      },
      iterations: ITERATIONS,
      after: (res) => {
        if (res.error || res.data?.api_token_rolling_stats_30min.length === 0)
          throw new Error("Error or no tokens found");
      },
    });

    metrics.push({ ...metric, group: "A" });
  });

  it("should measure cold cache performance", async () => {
    const metric = await benchmark<"GetTokenLiveDataQuery">({
      identifier: "Cold cache hit",
      exec: async (i) => {
        const client = await createClientCached();

        return await client.db.GetTokenLiveDataQuery({
          token: tokens[i],
        });
      },
      iterations: ITERATIONS,
      before: async () => await clearCache(),
      after: (res) => {
        if (res.error || res.data?.api_token_rolling_stats_30min.length === 0)
          throw new Error("Error or no tokens found");
      },
    });

    metrics.push({ ...metric, group: "A" });
  });

  it("should measure bypassing cache performance", async () => {
    const metric = await benchmark<"GetTokenLiveDataQuery">({
      identifier: "Bypassing cache",
      exec: async (i) => {
        const client = await createClientCacheBypass();
        return await client.db.GetTokenLiveDataQuery({
          token: tokens[i],
        });
      },
      iterations: ITERATIONS,
      after: (res) => {
        if (res.error || res.data?.api_token_rolling_stats_30min.length === 0)
          throw new Error("Error or no tokens found");
      },
    });

    metrics.push({ ...metric, group: "A" });
  });

  afterAll(() => {
    logMetrics(metrics);
    writeMetricsToFile(metrics, "GetTokenLiveData");
  });
});
