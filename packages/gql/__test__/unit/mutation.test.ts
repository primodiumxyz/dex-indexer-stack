import { beforeAll, describe } from "vitest";

import { createClient, GqlClient } from "../../src/index";

const tokenAddress = "EeP7gjHGjHTMEShEA8YgPXmYp6S3XvCDfQvkc8gy2kcL";

describe("mutation tests", () => {
  let gql: GqlClient;

  beforeAll(async () => {
    gql = await createClient({ url: "http://localhost:8090/v1/graphql", hasuraAdminSecret: "password" });
  });
});
