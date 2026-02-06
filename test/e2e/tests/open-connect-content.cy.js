// Copyright (C) 2026 by Posit Software, PBC.

describe("Open Connect Content", () => {
  before(() => {
    cy.resetConnect();
    cy.clearupDeployments();
    cy.setAdminCredentials();
  });

  afterEach(() => {
    cy.clearupDeployments();
  });

  it("opens deployed content in the explorer tree", () => {
    cy.on("uncaught:exception", () => false);
    cy.clearupDeployments("static");
    cy.visit("/?folder=/home/coder/workspace");
    cy.getPublisherSidebarIcon().click();
    cy.waitForPublisherIframe();
    cy.debugIframes();
    cy.expectInitialPublisherState();

    cy.createPCSDeployment("static", "index.html", "static", () => {
      return;
    }).deployCurrentlySelected();

    cy.getPublisherTomlFilePaths("static").then((filePaths) => {
      cy.loadTomlFile(filePaths.contentRecord.path).then((contentRecord) => {
        cy.runCommandPaletteCommand("Posit Publisher: Open Connect Content");
        cy.quickInputType("Connect server URL", contentRecord.server_url);
        cy.quickInputType("Connect content GUID", contentRecord.id);
      });
    });

    cy.retryWithBackoff(
      () =>
        cy.get("body").then(($body) => {
          if ($body.find(".explorer-viewlet:visible").length === 0) {
            const explorerButton =
              $body
                .find(
                  '[id="workbench.parts.activitybar"] .action-item[role="button"][aria-label="Explorer"]',
                )
                .get(0) || $body.find("a.codicon-explorer-view-icon").get(0);
            if (explorerButton) {
              explorerButton.click();
            }
          }
          return cy.get(".explorer-viewlet:visible");
        }),
      12,
      1000,
    ).should("be.visible");

    cy.retryWithBackoff(
      () => cy.get(".explorer-viewlet .explorer-item"),
      10,
      1000,
    ).should("exist");

    cy.get(".explorer-viewlet")
      .find('.monaco-list-row[aria-level="1"]')
      .first()
      .then(($row) => {
        if ($row.attr("aria-expanded") === "false") {
          cy.wrap($row).click();
        }
      });

    cy.retryWithBackoff(
      () =>
        cy.get(".explorer-viewlet .explorer-item a > span").then(($spans) => {
          return cy.wrap(
            $spans.filter((_, el) =>
              (el.textContent || "").includes("manifest.json"),
            ),
          );
        }),
      10,
      1000,
    ).should("be.visible");

    cy.retryWithBackoff(
      () =>
        cy.get(".explorer-viewlet .explorer-item a > span").then(($spans) => {
          return cy.wrap(
            $spans.filter((_, el) =>
              (el.textContent || "").includes("index.html"),
            ),
          );
        }),
      10,
      1000,
    ).should("be.visible");
  });
});
