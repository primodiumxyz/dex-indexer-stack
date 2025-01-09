import { afterAll, beforeAll, describe, it } from "vitest";
import { BenchmarkEnvironment } from "./setup";

describe("GetBulkTokenLiveData benchmarks", () => {
  let env: BenchmarkEnvironment;

  beforeAll(async () => {
    env = new BenchmarkEnvironment();
    await env.setup();
  });

  it("...", async () => {
    // ...
  });

  afterAll(async () => {
    await env.cleanup();
  });
});
