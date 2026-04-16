import "./commands";
import { configure } from "@testing-library/cypress";

// Import cypress-terminal-report for browser log collection
import "cypress-terminal-report/src/installLogsCollector";

// Import @cypress/grep for test filtering by tags (@pcc, etc.)
import { register as registerCypressGrep } from "@cypress/grep";
registerCypressGrep();

// Combined uncaught:exception handler for all known issues
Cypress.on("uncaught:exception", (err) => {
  // Ignore the Quarto extension error
  if (
    err.message &&
    err.message.includes(
      "Cannot read properties of undefined (reading 'experiment')",
    )
  ) {
    return false;
  }
  // Ignore common VSCode/code-server errors
  if (
    err.name === "Canceled" ||
    err.message === "Canceled" ||
    err.message.includes("Network Error") ||
    err.message.includes("ResizeObserver loop") ||
    err.message.includes("Cannot read properties of null")
  ) {
    return false;
  }
  // Log but don't fail on other errors in CI
  if (Cypress.env("CI") === "true") {
    console.error("Uncaught exception:", err.message);
    return false;
  }
  // In dev, allow errors to fail tests unless explicitly bypassed
  return true;
});

// Delete previous vscode sessions, avoid starting up tests with previous editor data.
Cypress.on("window:before:load", (win) => {
  return win.indexedDB.databases().then((dbrecs) => {
    for (var i = 0; i < dbrecs.length; i++) {
      win.indexedDB.deleteDatabase(dbrecs[i].name);
    }
  });
});

configure({ testIdAttribute: "data-automation" });

// Dismiss the VSCode onboarding overlay if it appears.
// Newer code-server versions may show a "Welcome to Visual Studio Code"
// dialog that covers the entire UI and blocks interaction.
Cypress.Commands.add("dismissOnboardingOverlay", () => {
  cy.get("body", { log: false }).then(($body) => {
    const overlay = $body.find(".onboarding-a-overlay.visible");
    if (overlay.length > 0) {
      cy.log("Dismissing VSCode onboarding overlay");
      // Remove the overlay and its backdrop from the DOM entirely.
      // Pressing Escape doesn't reliably close it, and the overlay
      // blocks all interaction with the underlying UI.
      overlay.remove();
      $body.find(".onboarding-a-overlay").remove();
      // Also remove any remaining backdrop
      $body.find(".onboarding-backdrop").remove();
      cy.log("Onboarding overlay removed from DOM");
    }
  });
});

// Global command for skipping tests in CI
Cypress.skipCI = (fn) => (Cypress.env("CI") === "true" ? fn.skip : fn);

// Debugging command
Cypress.debugIf = (fn) => (Cypress.env("DEBUG_CYPRESS") ? fn : () => {});

/* eslint-disable mocha/no-top-level-hooks */
afterEach(() => {
  if (Cypress.env("DEBUG_CYPRESS") === "true") {
    cy.debugIframes();
  }
});
/* eslint-enable mocha/no-top-level-hooks */
