const { defineConfig } = require("cypress");
const fs = require("fs");
const path = require("path");
const { get1PasswordSecret } = require("./support/op-utils");
const {
  authenticateOAuthDevice,
  runDeviceWorkflow,
} = require("./support/oauth-task");
const { confirmPCCPublishSuccess } = require("./support/publish-success-task");

// Load shared E2E config (timeouts, etc.)
const e2eConfig = require("./config/e2e.json");

const DEBUG_CYPRESS = process.env.DEBUG_CYPRESS === "true";
const ACTIONS_STEP_DEBUG = process.env.ACTIONS_STEP_DEBUG === "true";
// Use robust logic to detect CI in both local and CI environments (handles boolean or string)
const isCI = process.env.CI === true || process.env.CI === "true";

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
      runMode: 3, // Retry failed tests in run mode (CI)
      openMode: 0,
    },
    defaultCommandTimeout: isCI
      ? e2eConfig.timeouts.ciDefaultCommandTimeout
      : e2eConfig.timeouts.defaultCommandTimeout,
    pageLoadTimeout: isCI
      ? e2eConfig.timeouts.ciPageLoadTimeout
      : e2eConfig.timeouts.pageLoadTimeout,
    cookies: {
      preserve: /_xsrf|session|connect\.sid|auth|oauth/,
    },
    experimentalOriginDependencies: true,
    // eslint-disable-next-line no-unused-vars
    setupNodeEvents(on, config) {
      // Install cypress-terminal-report for enhanced logging in headless mode
      require("cypress-terminal-report/src/installLogsPrinter")(on, {
        printLogsToConsole: "always",
        includeSuccessfulHookLogs: true,
        commandTrimLength: 800,
        compactLogs: 1,
      });

      on("task", {
        authenticateOAuthDevice,
        print(message) {
          if (typeof message !== "undefined") {
            console.log(message);
          }
          return null;
        },
        async runDeviceWorkflow({ email, password, env = "staging" }) {
          return await runDeviceWorkflow({ email, password, env });
        },
        confirmPCCPublishSuccess,
      });
    },
  },
  env: {
    BOOTSTRAP_ADMIN_API_KEY: "", // To be updated by Cypress when spinning up
    BOOTSTRAP_SECRET_KEY: "bootstrap-secret.key", // To be updated by Cypress when spinning up
    CI: process.env.CI === true || process.env.CI === "true" ? "true" : "false",
    DEBUG_CYPRESS: process.env.DEBUG_CYPRESS || "false",
    CONNECT_SERVER_URL: "http://localhost:3939",
    CONNECT_MANAGER_URL: "http://localhost:4723",
    CONNECT_CLOUD_ENV: process.env.CONNECT_CLOUD_ENV || "staging",
    pccConfig,
  },
  chromeWebSecurity: false,
  video: DEBUG_CYPRESS || ACTIONS_STEP_DEBUG,
  numTestsKeptInMemory: isCI ? 0 : 50,
});
