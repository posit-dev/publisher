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

// Wipe VSCode's IndexedDB for a clean start, and strip the code-server
// onboarding overlay whenever it renders. The wipe clears "user has seen
// onboarding" state, so the overlay reappears every test load; an observer
// avoids racing against when it's inserted.
Cypress.on("window:before:load", (win) => {
  const stripOnboarding = () => {
    win.document
      .querySelectorAll(".onboarding-a-overlay, .onboarding-backdrop")
      .forEach((node) => node.remove());
  };
  const observer = new win.MutationObserver(stripOnboarding);
  observer.observe(win.document.documentElement, {
    childList: true,
    subtree: true,
  });
  stripOnboarding();

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

/* eslint-disable mocha/no-top-level-hooks */
afterEach(() => {
  if (Cypress.env("DEBUG_CYPRESS") === "true") {
    cy.debugIframes();
  }
});
/* eslint-enable mocha/no-top-level-hooks */
