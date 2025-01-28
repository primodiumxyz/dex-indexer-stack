import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts", "bin/index": "bin/index.ts" },
  outDir: "dist",
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  minify: true,
  tsconfig: "tsconfig.build.json",
});
