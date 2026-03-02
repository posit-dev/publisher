// Copyright (C) 2025 by Posit Software, PBC.

const WORKBENCH_BASE_URL = Cypress.env("WORKBENCH_URL");

describe("Workbench > Positron", { baseUrl: WORKBENCH_BASE_URL }, () => {
  before(() => {
    cy.initializeConnect();
  });

  beforeEach(() => {
    cy.clearupDeployments();
    // Reset and restart the Workbench container before each test to ensure a clean state
    cy.restartWorkbench();
    cy.checkPositronExtension();
    cy.visitAndLoginToWorkbench();
    cy.startPositronSession();
  });

  context("Connect", () => {
    it("Static Content Deployment", () => {
      cy.createPWBDeployment(
        "static",
        "index.html",
        "static",
        (tomlFiles) => {
          const config = tomlFiles.config.contents;
          expect(config.title).to.equal("static");
          expect(config.type).to.equal("html");
          expect(config.entrypoint).to.equal("index.html");
          expect(config.files[0]).to.equal("/index.html");
          expect(config.files[1]).to.equal(
            `/.posit/publish/${tomlFiles.config.name}`,
          );
          expect(config.files[2]).to.equal(
            `/.posit/publish/deployments/${tomlFiles.contentRecord.name}`,
          );
        },
        "Connect",
      ).deployCurrentlySelected();
    });
  });
});
