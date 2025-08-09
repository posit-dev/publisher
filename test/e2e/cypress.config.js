const { defineConfig } = require("cypress");

const DEBUG_CYPRESS = process.env.DEBUG_CYPRESS === "true";
const ACTIONS_STEP_DEBUG = process.env.ACTIONS_STEP_DEBUG === "true";
const isCI = process.env.CI === "true";

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
    // eslint-disable-next-line no-unused-vars
    setupNodeEvents(on, config) {
      on("task", {
        print(message) {
          if (typeof message !== "undefined") {
            console.log(message);
          }
          return null;
        },
      });
      // implement node event listeners here
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
  },
  chromeWebSecurity: false,
  video: DEBUG_CYPRESS || ACTIONS_STEP_DEBUG,
  numTestsKeptInMemory: isCI ? 0 : 50,
});
