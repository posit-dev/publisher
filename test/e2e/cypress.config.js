const { defineConfig } = require("cypress");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { get1PasswordSecret } = require("./support/op-utils");
const { buildCypressTasks } = require("./support/oauth-task");

// Load shared E2E config (timeouts, etc.)
const e2eConfig = require("./config/e2e.json");

const DEBUG_CYPRESS = process.env.DEBUG_CYPRESS === "true";
const ACTIONS_STEP_DEBUG = process.env.ACTIONS_STEP_DEBUG === "true";
const isMockMode = process.env.CYPRESS_MOCK_CONNECT === "true";
const DEFAULT_EXEC_TIMEOUT = 60_000;

// Load PCC config and inject into Cypress env
const configPath = path.resolve(__dirname, "config/staging-pccqa.json");
const pccConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));

// Rewrite placeholder password with actual secret and handle failures.
// Skip in mock mode — PCC/OAuth tests are excluded and secrets are unavailable.
if (isMockMode) {
  // No-op: leave pccConfig password as-is (tests tagged @uses-posit-connect-cloud are excluded)
} else if (process.env.CI === "true" && process.env.PCC_USER_CCQA3) {
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
  // Electron is deprecated as a test browser in Cypress 16. CI already passes
  // --browser chrome; this makes local `cypress run`/`open` match.
  defaultBrowser: "chrome",
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

      // Non-sensitive values, read synchronously with Cypress.expose().
      // Merged here so values passed via --expose (e.g. grepTags in CI) win
      // without dropping these defaults.
      config.expose = {
        CI: process.env.CI === "true" ? "true" : "false",
        DEBUG_CYPRESS: process.env.DEBUG_CYPRESS || "false",
        CONNECT_SERVER_URL: "http://localhost:3939",
        CONNECT_CLOUD_ENV: process.env.CONNECT_CLOUD_ENV || "staging",
        WORKBENCH_URL: "http://localhost:8787",
        // When running in mock mode, run Connect Server and no-target tests only.
        // PCC and Positron tests are excluded — they require real services.
        ...(isMockMode && {
          grepTags: "@uses-posit-connect-server @uses-no-target",
          grepOmitFiltered: true,
        }),
        ...config.expose,
      };

      // Register @cypress/grep for test filtering by tags
      const { plugin: grepPlugin } = require("@cypress/grep/plugin");
      config = grepPlugin(config);

      // Register consolidated tasks
      const taskHandlers = buildCypressTasks(pccConfig);
      on("task", {
        ...taskHandlers,
        // Replacement for cy.exec(), which was removed in Cypress 16.
        // Use via the cy.shell() command in support/commands.js.
        exec({ command, timeout = DEFAULT_EXEC_TIMEOUT }) {
          return new Promise((resolve) => {
            exec(
              command,
              { cwd: config.projectRoot, timeout, maxBuffer: 10 * 1024 * 1024 },
              (error, stdout, stderr) => {
                // error.code is the exit code, or null if killed (e.g. timeout)
                const exitCode = !error
                  ? 0
                  : typeof error.code === "number"
                    ? error.code
                    : 1;
                resolve({
                  exitCode,
                  stdout: stdout.trim(),
                  stderr: (error?.killed ? error.message : stderr).trim(),
                });
              },
            );
          });
        },
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
  // Secrets only; read with cy.env(). Non-sensitive values are set as
  // `expose` in setupNodeEvents above.
  env: {
    // API key is passed from with-connect via CYPRESS_BOOTSTRAP_ADMIN_API_KEY env var
    BOOTSTRAP_ADMIN_API_KEY: process.env.CYPRESS_BOOTSTRAP_ADMIN_API_KEY || "",
    pccConfig,
  },
  chromeWebSecurity: false,
  video: DEBUG_CYPRESS || ACTIONS_STEP_DEBUG,
  // Keep memory usage low - tests shouldn't rely on cross-test state
  numTestsKeptInMemory: 0,
});
