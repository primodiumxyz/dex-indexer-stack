#!/usr/bin/env node
import fastifyWebsocket from "@fastify/websocket";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { createClient as createGqlClient } from "@primodiumxyz/solana-dex-indexer-gql";
import { config } from "dotenv";
import fastify from "fastify";
import { parseEnv } from "./parseEnv";
import { AppRouter, createAppRouter } from "../src/createAppRouter";
import { Service } from "../src/Service";

config({ path: "../../.env" });

export const env = parseEnv();

// @see https://fastify.dev/docs/latest/
export const server = fastify({
  maxParamLength: 5000,
  logger: true,
});

await server.register(import("@fastify/compress"));
await server.register(import("@fastify/cors"));
await server.register(fastifyWebsocket);

// k8s healthchecks
server.get("/healthz", (_, res) => res.code(200).send());
server.get("/readyz", (_, res) => res.code(200).send());
server.get("/", (_, res) => res.code(200).send("hello world"));

export const start = async () => {
  try {
    if (!env.GRAPHQL_URL && env.NODE_ENV === "production") {
      throw new Error("GRAPHQL_URL is not set");
    }

    const gqlClient = (
      await createGqlClient({
        url: env.NODE_ENV !== "production" ? "http://localhost:8090/v1/graphql" : env.GRAPHQL_URL,
        hasuraAdminSecret: env.NODE_ENV !== "production" ? "password" : env.HASURA_ADMIN_SECRET,
      })
    ).db;

    const service = await Service.create(gqlClient);

    // @see https://trpc.io/docs/server/adapters/fastify
    server.register(fastifyTRPCPlugin<AppRouter>, {
      prefix: "/trpc",
      useWSS: true,
      trpcOptions: {
        router: createAppRouter(),
        createContext: async () => ({ service }),
      },
    });

    await server.listen({ host: env.SERVER_HOST, port: env.SERVER_PORT });
    console.log(`Server listening on http://${env.SERVER_HOST}:${env.SERVER_PORT}`);

    // Apply WebSocket handler
    applyWSSHandler({
      wss: server.websocketServer,
      router: createAppRouter(),
      createContext: async () => ({ service })
    });

    return server;
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};
