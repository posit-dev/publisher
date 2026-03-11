// Copyright (C) 2026 by Posit Software, PBC.

// Disabled: This test is flaky and uninformative.
// Follow-up: https://github.com/posit-dev/publisher/issues/3688
describe.skip("Open Connect Content", () => {
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

    // Phase 2: Create and deploy static content
    cy.createPCSDeployment("static", "index.html", "static", () => {
      return;
    }).deployCurrentlySelected();

    // Phase 3: Read the content record to get server_url and content GUID
    cy.getPublisherTomlFilePaths("static").then((filePaths) => {
      cy.loadTomlFile(filePaths.contentRecord.path).then((contentRecord) => {
        // Stash values for use after the workspace switch
        const serverUrl = contentRecord.server_url;
        const contentGuid = contentRecord.id;

        // Phase 4: Run "Open Connect Content" via command palette
        cy.runCommandPaletteCommand("Posit Publisher: Open Connect Content");
        cy.quickInputType("Connect server URL", serverUrl);
        cy.quickInputType("Connect content GUID", contentGuid);

        // Wait for the quick input to close, confirming submission
        cy.get(".quick-input-widget").should("not.be.visible");

        // Phase 5: Wait for workspace switch to complete.
        // The extension has two code paths: updateWorkspaceFolders (no reload)
        // and openFolder (full page reload). We handle both by waiting for the
        // workbench to be present, then polling the explorer for the content GUID.
        cy.get(".monaco-workbench", { timeout: 120_000 }).should("be.visible");

        // Track the last diagnostic snapshot for the error message
        let lastDiag = "";
        cy.waitUntil(
          () => {
            try {
              const $body = Cypress.$("body");
              if ($body.length === 0) return false;

              // Dismiss any VS Code notification dialogs that might block
              // rendering (e.g. error messages from failed bundle fetches).
              $body
                .find(
                  '.notifications-toasts .codicon-notifications-clear-all, .notification-toast .action-label[aria-label="Close"]',
                )
                .each(function () {
                  this.click();
                });

              // Ensure the Explorer sidebar is visible; click its icon if not
              if ($body.find(".explorer-viewlet:visible").length === 0) {
                const explorerBtn =
                  $body
                    .find(
                      '[id="workbench.parts.activitybar"] .action-item[role="button"][aria-label="Explorer"]',
                    )
                    .get(0) ||
                  $body.find("a.codicon-explorer-view-icon").get(0);
                if (explorerBtn) explorerBtn.click();
                return false;
              }

              // Collect diagnostic info for debugging
              const allRows = $body
                .find(".explorer-viewlet .monaco-list-row")
                .map(function () {
                  const $el = Cypress.$(this);
                  return `[level=${$el.attr("aria-level")}] "${$el.text().substring(0, 60)}"`;
                })
                .get();
              lastDiag = `rows(${allRows.length}): ${allRows.slice(0, 10).join(" | ")}`;

              // Look for the content GUID anywhere in the explorer tree.
              // In multi-root workspace mode (code-server), the folder may
              // appear at aria-level 2 instead of 1.
              const guidRow = $body.find(
                `.explorer-viewlet .monaco-list-row:contains("${contentGuid}")`,
              );
              return guidRow.length > 0;
            } catch {
              // DOM may be briefly invalid during a full page reload
              return false;
            }
          },
          {
            timeout: 120_000,
            interval: 2_000,
            errorMsg: () =>
              `Content GUID "${contentGuid}" did not appear in the explorer within 120 seconds. Explorer state: ${lastDiag}`,
          },
        );

        // Phase 6: Expand the GUID folder and verify expected files
        cy.get(".explorer-viewlet")
          .find(`.monaco-list-row:contains("${contentGuid}")`)
          .first()
          .then(($row) => {
            if ($row.attr("aria-expanded") === "false") {
              cy.wrap($row).click();
            }
          });

        cy.get(".explorer-viewlet", { timeout: 30_000 })
          .should("contain", "manifest.json")
          .and("contain", "index.html");
      });
    });
  });
});
