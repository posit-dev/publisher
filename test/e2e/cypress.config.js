const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    baseUrl: "http://localhost:8080",
    supportFile: "support/index.js",
    specPattern: "tests/**/*.cy.{js,jsx,ts,tsx}",
    retries: {
      runMode: 1,
      openMode: 0,
    },
    // eslint-disable-next-line no-unused-vars
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
  env: {
    BOOTSTRAP_ADMIN_API_KEY: "", // To be updated by Cypress when spinning up
    BOOTSTRAP_SECRET_KEY: "bootstrap-secret.key", // To be updated by Cypress when spinning up
    CONNECT_SERVER_URL: "http://localhost:3939",
    CONNECT_MANAGER_URL: "http://localhost:4723",
  },
  chromeWebSecurity: false,
});
