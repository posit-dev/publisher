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
