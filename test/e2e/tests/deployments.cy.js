// Copyright (C) 2025 by Posit Software, PBC.

describe("Deployments Section", () => {
  beforeEach(() => {
    cy.resetConnect();
    cy.setAdminCredentials();
    cy.visit("/");
  });

  it("Static Content Deployment", () => {
    // Temporarily ignore uncaught exception due to a vscode worker being cancelled at some point.
    cy.on("uncaught:exception", () => false);

    // Open the entrypoint ahead of time for easier selection later.
    cy.get(".explorer-viewlet").find('[aria-label="static"]').click();

    cy.get(".explorer-viewlet")
      .find('[aria-label="index.html"]')
      .should("be.visible")
      .dblclick();

    cy.get(".tabs-container")
      .find('[aria-label="index.html"]')
      .should("be.visible");

    cy.getPublisherSidebarIcon()
      .should("be.visible", { timeout: 10000 })
      .click();

    cy.publisherWebview()
      .findByTestId("select-deployment")
      .then((dplyPicker) => {
        Cypress.$(dplyPicker).trigger("click");
      });

    cy.get(".quick-input-widget").should("be.visible");

    cy.get(".quick-input-titlebar").should("have.text", "Select Deployment");

    cy.get(".quick-input-widget").type("{enter}");

    cy.get(".quick-input-widget")
      .find('[aria-label="static/index.html, Open Files"]')
      .should("be.visible")
      .click();

    cy.get(".quick-input-widget")
      .find(".quick-input-filter input")
      .should("have.value", "static")
      .type("{enter}");

    cy.get(".quick-input-widget")
      .find(
        '[aria-label="admin-code-server, http://connect-publisher-e2e:3939"]',
      )
      .should("be.visible")
      .click();

    cy.publisherWebview()
      .findByTestId("deploy-button")
      .should("be.visible")
      .then((dplyBtn) => {
        Cypress.$(dplyBtn).trigger("click");
      });

    // Wait for deploying  message to finish
    cy.get(".notifications-toasts")
      .should("be.visible")
      .findByText("Deploying your project: Starting to Deploy...")
      .should("not.exist");

    cy.findByText("Deployment was successful").should("be.visible");

    cy.loadProjectConfigFile("static").then((config) => {
      expect(config.title).to.equal("static");
      expect(config.type).to.equal("html");
      expect(config.entrypoint).to.equal("index.html");
      expect(config.files[0]).to.equal("/index.html");
    });
  });
});
