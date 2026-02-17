import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for Publisher E2E tests.
 *
 * Key differences from Cypress:
 * - Built-in parallelization (no paid service needed)
 * - Native async/await instead of command chaining
 * - Better trace/debug tooling
 */
export default defineConfig({
  testDir: "./playwright-tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: process.env.CI ? "github" : "html",

  use: {
    baseURL: "http://localhost:8080",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: process.env.DEBUG_PLAYWRIGHT ? "on" : "off",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Global setup/teardown
  globalSetup: "./playwright-tests/global-setup.mjs",

  // Timeouts
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
});
