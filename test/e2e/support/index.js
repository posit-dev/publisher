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
Cypress.skipCI = (fn) => (Cypress.env("CI") ? fn.skip : fn);

// Debugging command
Cypress.debugIf = (fn) => (Cypress.env("DEBUG_CYPRESS") ? fn : () => {});

/* eslint-disable mocha/no-top-level-hooks */
afterEach(() => {
  cy.debugIframes();
});
/* eslint-enable mocha/no-top-level-hooks */
