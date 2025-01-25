import { beforeAll, describe, expect, it } from "vitest";

import { createClient, GqlClient } from "../../src/index";

describe("subscription tests", () => {
  let gql: GqlClient;

  beforeAll(async () => {
    gql = await createClient({ url: "http://localhost:8080/v1/graphql", hasuraAdminSecret: "password" });
  });

  it("todo", () => {
    expect(true).toBe(true);
  });
});
