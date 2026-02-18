// Copyright (C) 2026 by Posit Software, PBC.

describe("Open Connect Content", () => {
  before(() => {
    cy.initializeConnect();
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
        // Capture the current URL before running the command
        cy.url().then((originalUrl) => {
          cy.runCommandPaletteCommand("Posit Publisher: Open Connect Content");
          cy.quickInputType("Connect server URL", contentRecord.server_url);
          cy.quickInputType("Connect content GUID", contentRecord.id);

          // Wait for the quick input to close, indicating the command has been submitted
          cy.get(".quick-input-widget").should("not.be.visible");

          // Wait for the workspace to actually start reloading by detecting URL change.
          // This prevents the race condition where retries run against the old workspace
          // before VS Code has started loading the new one.
          cy.url({ timeout: 30000 }).should("not.eq", originalUrl);

          // Wait for the workspace to reload with the Connect content.
          // The GUID appears in the explorer as a root folder after the workspace switch.
          // Use { timeout: 0 } in the inner cy.contains() so retryWithBackoff controls
          // the retry timing rather than cy.contains() blocking on its own timeout.
          cy.retryWithBackoff(
            () =>
              cy.get("body", { timeout: 0 }).then(($body) => {
                const explorer = $body.find(".explorer-viewlet");
                if (explorer.length === 0) {
                  return Cypress.$(); // Explorer not yet rendered, return empty to retry
                }
                const row = explorer.find(
                  `.monaco-list-row[aria-level='1']:contains("${contentRecord.id}")`,
                );
                return row.length > 0 ? cy.wrap(row) : Cypress.$();
              }),
            20,
            1500,
          ).should("exist");
        });
      });
    });

    cy.retryWithBackoff(
      () =>
        cy.get("body", { timeout: 0 }).then(($body) => {
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
            return Cypress.$(); // Return empty to retry after clicking
          }
          const explorer = $body.find(".explorer-viewlet:visible");
          return explorer.length > 0 ? cy.wrap(explorer) : Cypress.$();
        }),
      12,
      1000,
    ).should("be.visible");

    cy.retryWithBackoff(
      () =>
        cy.get("body", { timeout: 0 }).then(($body) => {
          const items = $body.find(".explorer-viewlet .explorer-item");
          return items.length > 0 ? cy.wrap(items) : Cypress.$();
        }),
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
        cy.get("body", { timeout: 0 }).then(($body) => {
          const match = $body.find(
            '.explorer-viewlet .explorer-item a > span:contains("manifest.json")',
          );
          return match.length > 0 ? cy.wrap(match) : Cypress.$();
        }),
      10,
      1000,
    ).should("be.visible");

    cy.retryWithBackoff(
      () =>
        cy.get("body", { timeout: 0 }).then(($body) => {
          const match = $body.find(
            '.explorer-viewlet .explorer-item a > span:contains("index.html")',
          );
          return match.length > 0 ? cy.wrap(match) : Cypress.$();
        }),
      10,
      1000,
    ).should("be.visible");
  });
});
