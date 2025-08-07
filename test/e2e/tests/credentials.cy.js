// Copyright (C) 2025 by Posit Software, PBC.

describe("Credentials Section", () => {
  beforeEach(() => {
    cy.resetConnect();
    cy.resetCredentials();
    cy.visit("/");
  });

  it("New Credential", () => {
    cy.getPublisherSidebarIcon()
      .should("be.visible", { timeout: 10000 })
      .click();
    cy.waitForPublisherIframe(); // Wait after triggering extension
    cy.debugIframes();

    cy.toggleCredentialsSection();
    cy.debugIframes();
    cy.publisherWebview()
      .findByText("No credentials have been added yet.")
      .should("be.visible");

    cy.clickSectionAction("New Credential");
    cy.get(".quick-input-widget").should("be.visible");

    cy.get(".quick-input-titlebar").should(
      "have.text",
      "Create a New Credential",
    );

    cy.get(".quick-input-message").should(
      "include.text",
      "Please provide the Posit Connect server's URL",
    );

    cy.get(".quick-input-widget").type(
      `http://connect-publisher-e2e:3939{enter}`,
    );

    cy.get(".quick-input-message", { timeout: 10000 }).should(
      "include.text",
      "The API key to be used to authenticate with Posit Connect.",
    );

    cy.get(".quick-input-widget").type(
      `${Cypress.env("BOOTSTRAP_ADMIN_API_KEY")}{enter}`,
    );

    cy.get(".quick-input-message", { timeout: 10000 }).should(
      "include.text",
      "Enter a unique nickname for this server.",
    );

    cy.get(".quick-input-widget").type("admin-code-server{enter}");

    cy.retryWithBackoff(
      () =>
        cy.findInPublisherWebview('[data-automation="admin-code-server-list"]'),
      5,
      500,
    ).then(($credRecord) => {
      expect($credRecord.find(".tree-item-title").text()).to.equal(
        "admin-code-server",
      );
    });
  });

  it("Existing Credentials Load", () => {
    cy.setDummyCredentials();
    cy.getPublisherSidebarIcon()
      .should("be.visible", { timeout: 10000 })
      .click();
    cy.waitForPublisherIframe(); // Wait after triggering extension
    cy.debugIframes();

    cy.toggleCredentialsSection();
    cy.debugIframes();
    cy.publisherWebview()
      .findByText("No credentials have been added yet.")
      .should("not.exist");

    cy.retryWithBackoff(
      () =>
        cy.findInPublisherWebview(
          '[data-automation="dummy-credential-one-list"]',
        ),
      5,
      500,
    ).should(($credRecord) => {
      expect($credRecord.find(".tree-item-title").text()).to.equal(
        "dummy-credential-one",
      );
    });

    cy.retryWithBackoff(
      () =>
        cy.findInPublisherWebview(
          '[data-automation="dummy-credential-two-list"]',
        ),
      5,
      500,
    ).should(($credRecord) => {
      expect($credRecord.find(".tree-item-title").text()).to.equal(
        "dummy-credential-two",
      );
    });
  });

  // As of this moment, haven;t found a way to trigger the context menu (right-click)
  // within webview elements.
  // Deleting a credential requires right-click on the credential record for a submenu to show up.
  // it("Delete Credentials", () => {});
  /**
   * Dev Note, to consider how we trigger context menu events from components
   e.target?.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        clientX: e.clientX,
        clientY: e.clientY,
      }),
    );
   */
});
