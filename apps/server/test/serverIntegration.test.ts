import { PrivyClient } from "@privy-io/server-auth";
import { createTRPCProxyClient, createWSClient, httpBatchLink, splitLink, wsLink } from "@trpc/client";
import { Unsubscribable } from "@trpc/server/observable";
import { config } from "dotenv";
import { assert, beforeAll, describe, expect, inject, it } from "vitest";
import WebSocket from "ws";
import { parseEnv } from "../bin/parseEnv";
import { AppRouter } from "../src/createAppRouter";

config({ path: "../../../.env" });
const env = parseEnv();
const tokenId = "722e8490-e852-4298-a250-7b0a399fec57";
const port = inject("port");
const host = inject("host");

describe("Server Integration Tests", () => {
  let client: ReturnType<typeof createTRPCProxyClient<AppRouter>>;
  const privy = new PrivyClient(env.PRIVY_APP_ID, env.PRIVY_APP_SECRET);

  beforeAll(async () => {
    const wsClient = createWSClient({
      url: `ws://${host}:${port}/trpc`,
      WebSocket: WebSocket as any,
    });

    client = createTRPCProxyClient<AppRouter>({
      links: [
        splitLink({
          condition: (op) => op.type === "subscription",
          true: wsLink({ client: wsClient }),
          false: httpBatchLink({
            url: `http://${host}:${port}/trpc`,
            headers: {
              Authorization: `Bearer ${(await privy.getTestAccessToken()).accessToken}`,
            },
          }),
        }),
      ],
    });
  });

  it("should get status", async () => {
    const result = await client.getStatus.query();
    expect(result).toEqual({ status: 200 });
  });

  it("should airdrop tokens to a user", async () => {
    const _result = await client.airdropNativeToUser.mutate({
      amount: "1000000000000000000",
    });

    const id = _result?.insert_wallet_transaction_one?.id;

    expect(id).toBeDefined();
  });

  it("should buy tokens", async () => {
    const result = await client.buyToken.mutate({
      tokenId,
      amount: "100",
      tokenPrice: "1000000000",
    });

    expect(result).toBeDefined();
  });

  it("should sell tokens", async () => {
    const result = await client.sellToken.mutate({
      tokenId,
      amount: "100",
      tokenPrice: "1000000000",
    });

    expect(result).toBeDefined();
  });

  it("should record client events", async () => {
    const result = await client.recordClientEvent.mutate({
      userAgent: "test",
      eventName: "test",
      source: "test",
      metadata: JSON.stringify({
        test: "test",
      }),
      errorDetails: "test",
    });

    expect(result).toBeDefined();
  });

  it("should get the SOL/USD price", async () => {
    const result = await client.getSolUsdPrice.query();
    expect(result).toBeGreaterThan(0);
  });

  it("should subscribe to the SOL/USD price", async () => {
    const initialPrice = await client.getSolUsdPrice.query();

    // Create a promise that resolves when we get a new price
    const priceUpdatePromise = new Promise<Unsubscribable>((resolve, reject) => {
      const subscription = client.subscribeSolPrice.subscribe(undefined, {
        onData: (price) => {
          if (price !== initialPrice) {
            resolve(subscription);
          }

          setTimeout(() => {
            reject(new Error("Timeout"));
          }, 10_000);
        },
      });
    });

    // Wait for first & next price from subscription
    const subscription = await priceUpdatePromise;
    subscription.unsubscribe();
  });
});
