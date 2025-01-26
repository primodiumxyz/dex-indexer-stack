import { beforeAll, describe, expect, it } from "vitest";

import { GqlClient } from "../../src/index";
import { createClientNoCache } from "../lib/common";

describe("mutation tests", () => {
  let gql: GqlClient;

  beforeAll(async () => {
    gql = await createClientNoCache();
  });

  it("todo", () => {
    expect(true).toBe(true);
  });
});
