import "./commands";
import { configure } from "@testing-library/cypress";

// Delete previous vscode sessions, avoid starting up tests with previous editor data.
Cypress.on("window:before:load", (win) => {
  return win.indexedDB.databases().then((dbrecs) => {
    for (var i = 0; i < dbrecs.length; i++) {
      win.indexedDB.deleteDatabase(dbrecs[i].name);
    }
  });
});

configure({ testIdAttribute: "data-automation" });

// Global command for skipping tests in CI
Cypress.skipCI = (fn) => (Cypress.env("CI") === "true" ? fn.skip : fn);

// Debugging command
Cypress.debugIf = (fn) => (Cypress.env("DEBUG_CYPRESS") ? fn : () => {});

// Handle common VSCode/code-server errors that shouldn't fail tests
// eslint-disable-next-line no-unused-vars
Cypress.on("uncaught:exception", (err, runnable) => {
  // These are common errors from VSCode that don't affect our tests
  if (
    err.message === "Canceled" ||
    err.message.includes("Network Error") ||
    err.message.includes("ResizeObserver loop") ||
    err.message.includes("Cannot read properties of null")
  ) {
    return false; // Return false to prevent the error from failing the test
  }

  // Log but don't fail on other errors in CI
  if (Cypress.env("CI") === "true") {
    console.error("Uncaught exception:", err.message);
    return false;
  }

  // In dev, allow errors to fail tests unless explicitly bypassed
  return true;
});

/* eslint-disable mocha/no-top-level-hooks */
afterEach(() => {
  if (Cypress.env("DEBUG_CYPRESS") === "true") {
    cy.debugIframes();
  }
});
/* eslint-enable mocha/no-top-level-hooks */
