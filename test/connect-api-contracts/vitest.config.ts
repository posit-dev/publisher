import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["src/setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    include: ["src/endpoints/**/*.test.ts"],
    // All test files share a single mock server, so they must run sequentially
    // to avoid interfering with each other's captured requests and overrides.
    fileParallelism: false,
  },
});
