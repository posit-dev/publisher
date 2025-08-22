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

    cy.get(".quick-input-and-message input", { timeout: 10000 }).should(
      "have.attr",
      "placeholder",
      "Select authentication method",
    );

    cy.get(".quick-input-list .monaco-list-row").eq(1).click();

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
        cy.findUniqueInPublisherWebview(
          '[data-automation="admin-code-server-list"]',
        ),
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
        cy.findUniqueInPublisherWebview(
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
        cy.findUniqueInPublisherWebview(
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

  it("Delete Credential", () => {
    cy.setDummyCredentials();
    cy.getPublisherSidebarIcon()
      .should("be.visible", { timeout: 10000 })
      .click();
    cy.waitForPublisherIframe(); // Wait after triggering extension
    cy.debugIframes();

    cy.toggleCredentialsSection();
    cy.publisherWebview();
    cy.retryWithBackoff(() =>
      cy.findUniqueInPublisherWebview(
        '[data-automation="dummy-credential-one-list"]',
      ),
    ).then(($credRecord) => {
      cy.wrap($credRecord).should("be.visible").trigger("mouseover");
      cy.wrap($credRecord)
        .find('[aria-label="Delete Credential"]')
        // Required to click the delete button that's shown only via hover
        .click({ force: true });
    });
    cy.get(".dialog-buttons").findByText("Delete").should("be.visible").click();
    cy.get('[data-automation="dummy-credential-one-list"]').should("not.exist");
  });
});
