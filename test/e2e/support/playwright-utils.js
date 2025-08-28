// Playwright utility functions for E2E tests
const path = require("path");
const e2eConfig = require(path.resolve(__dirname, "../config/e2e.json"));

function getPlaywrightTimeout() {
  return process.env.CI === true || process.env.CI === "true"
    ? e2eConfig.timeouts.ciDefaultCommandTimeout
    : e2eConfig.timeouts.defaultCommandTimeout;
}

module.exports = { getPlaywrightTimeout };
