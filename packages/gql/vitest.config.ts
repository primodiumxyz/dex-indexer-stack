import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./__test__/setup.ts"],
    hookTimeout: 300000,
    testTimeout: 600000,
    fileParallelism: false,
    maxConcurrency: 1,
  },
});
