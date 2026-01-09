// Copyright (C) 2026 by Posit Software, PBC.

describe("Open Connect Content", () => {
  before(() => {
    cy.resetConnect();
    cy.clearupDeployments();
    cy.setAdminCredentials();
  });

  beforeEach(() => {
    cy.visit("/");
    cy.getPublisherSidebarIcon().click();
    cy.waitForPublisherIframe();
    cy.debugIframes();
  });

  afterEach(() => {
    cy.clearupDeployments();
  });

  it("opens deployed content in the explorer tree", () => {
    cy.on("uncaught:exception", () => false);
    cy.expectInitialPublisherState();

    cy.createPCSDeployment("static", "index.html", "static", () => {
      return;
    }).deployCurrentlySelected();

    cy.getPublisherTomlFilePaths("static").then((filePaths) => {
      cy.loadTomlFile(filePaths.contentRecord.path).then((contentRecord) => {
        cy.runCommandPaletteCommand(
          "Posit Publisher: Open Connect Content",
        );
        cy.quickInputType("Connect server URL", contentRecord.server_url);
        cy.quickInputType("Connect content GUID", contentRecord.id);
      });
    });

    cy.get("body").then(($body) => {
      if ($body.find(".explorer-viewlet:visible").length === 0) {
        cy.get("a.codicon-explorer-view-icon").first().click();
        cy.get(".explorer-viewlet").should("be.visible");
      }
    });

    cy.get(".explorer-viewlet", { timeout: 60000 })
      .find(".tree-item-title")
      .contains("manifest.json", { timeout: 60000 })
      .should("be.visible");

    cy.get(".explorer-viewlet")
      .find(".tree-item-title")
      .contains("index.html", { timeout: 60000 })
      .should("be.visible");
  });
});
