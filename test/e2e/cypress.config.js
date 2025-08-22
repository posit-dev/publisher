const { defineConfig } = require("cypress");
const { authenticateOAuthDevice } = require("./support/oauth-task");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const DEBUG_CYPRESS = process.env.DEBUG_CYPRESS === "true";
const ACTIONS_STEP_DEBUG = process.env.ACTIONS_STEP_DEBUG === "true";
const isCI = process.env.CI === "true";

// Load PCC config and inject into Cypress env
const configPath = path.resolve(__dirname, "config/staging-pccqa.json");
const pccConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));

function getAwsSecret(secretName) {
  try {
    const result = execSync(
      `aws secretsmanager get-secret-value --secret-id "${secretName}" --query SecretString --output text`,
      { encoding: "utf8", stdio: "pipe" },
    );
    return result.trim();
  } catch (error) {
    console.warn(
      `Warning: Could not fetch AWS secret "${secretName}": ${error.message}`,
    );
    console.warn(
      "Using placeholder value. Make sure AWS CLI is configured if you need real credentials.",
    );
    return "PLACEHOLDER_PASSWORD"; // Return a fallback so config doesn't break
  }
}

// Rewrite placeholder password with actual secret and handle failures
if (process.env.CI === "true" && process.env.PCC_USER_CCQA3) {
  pccConfig.pcc_user_ccqa3.auth.password = process.env.PCC_USER_CCQA3;
} else if (pccConfig.pcc_user_ccqa3.auth.password === "UPDATE") {
  const fetchedPassword = getAwsSecret("vivid.qa.local.password.ccqa1");
  pccConfig.pcc_user_ccqa3.auth.password = fetchedPassword;
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
    defaultCommandTimeout: isCI ? 30000 : 4000,
    pageLoadTimeout: isCI ? 60000 : 30000,
    cookies: {
      preserve: /_xsrf|session|connect\.sid|auth|oauth/,
    },
    experimentalOriginDependencies: true,
    // eslint-disable-next-line no-unused-vars
    setupNodeEvents(on, config) {
      on("task", {
        authenticateOAuthDevice,
        print(message) {
          if (typeof message !== "undefined") {
            console.log(message);
          }
          return null;
        },
      });
    },
  },
  env: {
    BOOTSTRAP_ADMIN_API_KEY: "", // To be updated by Cypress when spinning up
    BOOTSTRAP_SECRET_KEY: "bootstrap-secret.key", // To be updated by Cypress when spinning up
    CI: process.env.CI || "false",
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
