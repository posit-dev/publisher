// Copyright (C) 2025 by Posit Software, PBC.

describe("Credentials Section", () => {
  beforeEach(() => {
    cy.resetConnect();
    cy.resetCredentials();
    cy.visit("/");
  });

  afterEach(() => {
    cy.resetCredentials();
  });

  it("New PCS Credential", () => {
    cy.getPublisherSidebarIcon().should("be.visible").click();
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

    cy.get(
      'input[aria-label*="Please select the platform for the new credential."]',
    ).should(
      "have.attr",
      "placeholder",
      "Please select the platform for the new credential.",
    );

    // Explicitly select the 'server' option by label
    cy.get(".quick-input-list-row").contains("server").click();

    cy.get(".quick-input-message").should(
      "include.text",
      "Please provide the Posit Connect server's URL",
    );

    cy.get(".quick-input-widget").type(
      `http://connect-publisher-e2e:3939{enter}`,
    );

    cy.get(".quick-input-and-message input").should(
      "have.attr",
      "placeholder",
      "Select authentication method",
    );

    cy.get(".quick-input-list .monaco-list-row").eq(1).click();

    cy.get(".quick-input-message").should(
      "include.text",
      "The API key to be used to authenticate with Posit Connect.",
    );

    cy.get(".quick-input-widget").type(
      `${Cypress.env("BOOTSTRAP_ADMIN_API_KEY")}{enter}`,
    );

    cy.get(".quick-input-message").should(
      "include.text",
      "Enter a unique nickname for this server.",
    );

    cy.get(".quick-input-widget").type("admin-code-server{enter}");

    cy.findInPublisherWebview('[data-automation="admin-code-server-list"]')
      .find(".tree-item-title")
      .should("have.text", "admin-code-server");
  });

  it("New PCC Credential - OAuth Device Code", () => {
    const user = Cypress.env("pccConfig").pcc_user_ccqa3;
    cy.addPCCCredential(user, "connect-cloud-credential");
    cy.findInPublisherWebview(
      '[data-automation="connect-cloud-credential-list"]',
    )
      .find(".tree-item-title")
      .should("have.text", "connect-cloud-credential");
  });

  it("Existing Credentials Load", () => {
    cy.setDummyCredentials();
    cy.getPublisherSidebarIcon().should("be.visible").click();
    cy.waitForPublisherIframe(); // Wait after triggering extension
    cy.debugIframes();

    cy.toggleCredentialsSection();
    cy.debugIframes();
    cy.publisherWebview()
      .findByText("No credentials have been added yet.")
      .should("not.exist");

    cy.findInPublisherWebview('[data-automation="dummy-credential-one-list"]')
      .find(".tree-item-title")
      .should("exist")
      .and("have.text", "dummy-credential-one");

    cy.findInPublisherWebview('[data-automation="dummy-credential-two-list"]')
      .find(".tree-item-title")
      .should("exist")
      .and("have.text", "dummy-credential-two");
  });

  it("Delete Credential", () => {
    cy.setDummyCredentials();
    cy.getPublisherSidebarIcon().should("be.visible").click();
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
