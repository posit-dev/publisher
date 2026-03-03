import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["src/setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    include: ["src/endpoints/**/*.test.ts"],
    fileParallelism: false,
  },
});
