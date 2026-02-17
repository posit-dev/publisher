const { defineConfig } = require("cypress");
const fs = require("fs");
const path = require("path");
const { get1PasswordSecret } = require("./support/op-utils");
const { buildCypressTasks } = require("./support/oauth-task");

// Load shared E2E config (timeouts, etc.)
const e2eConfig = require("./config/e2e.json");

const DEBUG_CYPRESS = process.env.DEBUG_CYPRESS === "true";
const ACTIONS_STEP_DEBUG = process.env.ACTIONS_STEP_DEBUG === "true";

// Load PCC config and inject into Cypress env
const configPath = path.resolve(__dirname, "config/staging-pccqa.json");
const pccConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));

// Rewrite placeholder password with actual secret and handle failures
if (process.env.CI === "true" && process.env.PCC_USER_CCQA3) {
  pccConfig.pcc_user_ccqa3.auth.password = process.env.PCC_USER_CCQA3;
} else if (pccConfig.pcc_user_ccqa3.auth.password === "UPDATE") {
  // Update as needed with correct 1pass vault and item names
  pccConfig.pcc_user_ccqa3.auth.password = get1PasswordSecret(
    "pcc_user_ccqa3",
    "password",
    "Publisher",
  );
}

module.exports = defineConfig({
  e2e: {
    baseUrl: "http://localhost:8080",
    supportFile: "support/index.js",
    specPattern: "tests/**/*.cy.{js,jsx,ts,tsx}",
    retries: {
      runMode: 2, // Retry failed tests in run mode (CI)
      openMode: 0,
    },
    defaultCommandTimeout: e2eConfig.timeouts.defaultCommandTimeout,
    pageLoadTimeout: e2eConfig.timeouts.pageLoadTimeout,
    cookies: {
      preserve: /_xsrf|session|connect\.sid|auth|oauth/,
    },
    experimentalOriginDependencies: true,
    blockHosts: [
      "*.google-analytics.com",
      "*.googletagmanager.com",
      "*.open-vsx.org",
      "*.android.clients.google.com",
    ],
    modifyObstructiveThirdPartyCode: true,
    setupNodeEvents(on, config) {
      // Install cypress-terminal-report for enhanced logging in headless mode
      require("cypress-terminal-report/src/installLogsPrinter")(on, {
        printLogsToConsole: "always",
        includeSuccessfulHookLogs: true,
        commandTrimLength: 800,
        compactLogs: 1,
      });

      // Register @cypress/grep for test filtering by tags
      const { plugin: grepPlugin } = require("@cypress/grep/plugin");
      config = grepPlugin(config);

      // Register consolidated tasks
      const taskHandlers = buildCypressTasks(pccConfig);
      on("task", {
        ...taskHandlers,
        print(message) {
          if (typeof message !== "undefined") {
            console.log(message);
          }
          return null;
        },
      });

      return config;
    },
  },
  env: {
    // API key is passed from with-connect via CYPRESS_BOOTSTRAP_ADMIN_API_KEY env var
    BOOTSTRAP_ADMIN_API_KEY: process.env.CYPRESS_BOOTSTRAP_ADMIN_API_KEY || "",
    CI: process.env.CI === "true" ? "true" : "false",
    DEBUG_CYPRESS: process.env.DEBUG_CYPRESS || "false",
    CONNECT_SERVER_URL: "http://localhost:3939",
    CONNECT_CLOUD_ENV: process.env.CONNECT_CLOUD_ENV || "staging",
    WORKBENCH_URL: "http://localhost:8787",
    pccConfig,
  },
  chromeWebSecurity: false,
  video: DEBUG_CYPRESS || ACTIONS_STEP_DEBUG,
  // Keep memory usage low - tests shouldn't rely on cross-test state
  numTestsKeptInMemory: 0,
});
