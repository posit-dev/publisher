import "./commands";
import { configure } from "@testing-library/cypress";

// Ignore the Quarto extension error that causes tests to fail
Cypress.on("uncaught:exception", (err) => {
  // Ignore the specific Quarto extension error
  if (
    err.message &&
    err.message.includes(
      "Cannot read properties of undefined (reading 'experiment')",
    )
  ) {
    return false; // Prevent Cypress from failing the test
  }
  // Let other errors fail the test
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
