const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    baseUrl: "http://localhost:8080",
    supportFile: "support/index.js",
    specPattern: "tests/**/*.cy.{js,jsx,ts,tsx}",
    // eslint-disable-next-line no-unused-vars
    setupNodeEvents(on, config) {
      on("before:browser:launch", (browser = {}, launchOptions) => {
        // Allow the non SSL access point to code server http://code-server:8080
        // to be treated as secure, else, vscode complains about security and does not load.
        // >  'crypto.subtle' is not available so webviews will not work.
        //    This is likely because the editor is not running in a secure context
        //    (https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts).
        if (browser.name === "chrome") {
          launchOptions.args.push(
            "--unsafely-treat-insecure-origin-as-secure=http://code-server:8080",
          );
        }
        return launchOptions;
      });
    },
  },
  env: {
    BOOTSTRAP_ADMIN_API_KEY: "", // To be updated by Cypress when spinning up
    BOOTSTRAP_SECRET_KEY: "bootstrap-secret.key",
    CONNECT_SERVER_URL: "http://localhost:3939", // Updated by docker-compose env var for CI runs
    CONNECT_MANAGER_URL: "http://localhost:4723", // Updated by docker-compose env var for CI runs
  },
  chromeWebSecurity: false,
});
