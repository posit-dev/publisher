// Copyright (C) 2025 by Posit Software, PBC.

// Purpose: Smoke-test that the Publisher extension loads, the webview is accessible,
// and all primary sections appear (Deployments, Credentials, Help).
// This is a fast readiness check used by other specs as a baseline.
describe("Common", () => {
  before(() => {
    cy.resetConnect();
    cy.clearupDeployments();
    cy.setAdminCredentials();
  });

  describe("Initial state", () => {
    beforeEach(() => {
      cy.visit("/");
      cy.getPublisherSidebarIcon().click();
      cy.waitForPublisherIframe();
      cy.debugIframes();
    });

    it("Publisher extension can be selected and initial state", () => {
      // Validates basic webview readiness and presence of core sections.
      // expectInitialPublisherState ensures the main call-to-action is present.
      // The retry checks reduce flakiness on CI cold starts.
      cy.expectInitialPublisherState();

      cy.retryWithBackoff(
        () =>
          cy.findUniqueInPublisherWebview(
            '[data-automation="publisher-deployment-section"]',
          ),
        5,
        500,
      ).should("exist");
      cy.retryWithBackoff(
        () =>
          cy.findUniqueInPublisherWebview(
            '[data-automation="publisher-credentials-section"]',
          ),
        5,
        500,
      ).should("exist");
      cy.debugIframes();
      cy.publisherWebview().then((body) => {
        cy.task("print", body.innerHTML);
      });
      cy.retryWithBackoff(
        () =>
          cy.findUniqueInPublisherWebview(
            '[data-automation="publisher-help-section"]',
          ),
        5,
        500,
      ).should("exist");
    });
  });

  describe("File and directory interaction", () => {
    beforeEach(() => {
      cy.visit("/");
      cy.getPublisherSidebarIcon().click();
      cy.waitForPublisherIframe();
      cy.debugIframes();
    });

    afterEach(() => {
      cy.clearupDeployments("static");
    });

    it("Clicking on a file name opens the file or opens directory", () => {
      cy.expectInitialPublisherState();
      cy.createPCSDeployment(
        "examples-shiny-python",
        "app.py",
        "file-click-test",
        () => {},
      );

      cy.publisherWebview()
        .find('[data-automation="project-files"]')
        .should("be.visible");

      cy.publisherWebview()
        .find('[data-automation="project-files"]')
        .contains(".tree-item-title", "README.md")
        .click();

      cy.get(".tabs-container", { timeout: 10000 })
        .find('[aria-label="README.md"]')
        .should("be.visible");

      cy.publisherWebview()
        .find('[data-automation="project-files"]')
        .contains(".tree-item-title", "README.md")
        .parents(".tree-item")
        .first()
        .find('input[type="checkbox"]')
        .should("not.be.checked");

      cy.publisherWebview()
        .find('[data-automation="project-files"]')
        .contains(".tree-item-title", "data")
        .parents(".tree-item")
        .first()
        .find(".codicon")
        .should("have.class", "codicon-chevron-right");

      cy.publisherWebview()
        .find('[data-automation="project-files"]')
        .contains(".tree-item-title", "data")
        .click();

      cy.publisherWebview()
        .find('[data-automation="project-files"]')
        .contains(".tree-item-title", "data")
        .parents(".tree-item")
        .first()
        .find(".codicon")
        .should("have.class", "codicon-chevron-down");

      cy.publisherWebview()
        .find('[data-automation="project-files"]')
        .contains(".tree-item-title", "data")
        .parents(".tree-item")
        .first()
        .find('input[type="checkbox"]')
        .should("not.be.checked");
    });
  });
});
