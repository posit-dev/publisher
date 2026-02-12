// Copyright (C) 2025 by Posit Software, PBC.

// Purpose: Validate credential creation, listing, and deletion flows for PCS and PCC.
// - New PCS Credential: full guided UI flow using API key.
// - New PCC Credential: OAuth Device Code flow with Playwright automation.
// - Existing Credentials Load: ensure listing reflects existing file-managed records.
// - Delete Credential: verify deletion from UI with hover-only button.
describe("Credentials Section", () => {
  // Global setup - run once for entire test suite
  before(() => {
    cy.initializeConnect();
  });

  beforeEach(() => {
    // Reset credentials for clean slate, but skip heavy Connect reset
    cy.resetCredentials();
    cy.visit("/");
    cy.getPublisherSidebarIcon().click();
    cy.waitForPublisherIframe();
    cy.debugIframes();
  });

  it("New PCS Credential", () => {
    // Starts via startCredentialCreationFlow("server") and completes setup with API key.
    // Asserts successful connection and nickname presence in the credentials tree

    // Ensure the credentials section is expanded and empty
    cy.expectCredentialsSectionEmpty();

    // Start the flow and select the 'server' platform via helper
    cy.startCredentialCreationFlow("server");

    // Continue with server URL and API key inputs
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

    cy.get(".quick-input-message", { timeout: 15000 }).should(
      "include.text",
      "Successfully connected to http://connect-publisher-e2e:3939 🎉",
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

  it("New PCC Credential - OAuth Device Code @pcc", () => {
    const user = Cypress.env("pccConfig").pcc_user_ccqa3;
    // Drive full OAuth UI flow and nickname entry via helper
    cy.addPCCCredential(user, "connect-cloud-credential");

    // Verify the credential appears in the list
    cy.toggleCredentialsSection();
    cy.refreshCredentials();

    cy.findInPublisherWebview(
      '[data-automation="connect-cloud-credential-list"]',
    )
      .find(".tree-item-title")
      .should("have.text", "connect-cloud-credential");
  });

  it("Existing Credentials Load", () => {
    // Seeds two dummy credentials and validates they render correctly in the list.
    cy.setDummyCredentials();
    cy.toggleCredentialsSection();
    cy.refreshCredentials();

    cy.publisherWebview()
      .findByText("No credentials have been added yet.")
      .should("not.exist");

    cy.findUniqueInPublisherWebview(
      '[data-automation="dummy-credential-one-list"]',
    )
      .find(".tree-item-title")
      .should("exist")
      .and("have.text", "dummy-credential-one");

    cy.findUniqueInPublisherWebview(
      '[data-automation="dummy-credential-two-list"]',
    )
      .find(".tree-item-title")
      .should("exist")
      .and("have.text", "dummy-credential-two");
  });

  it("Delete Credential", () => {
    // Hovers to reveal delete action, confirms, and asserts removal from the list.
    cy.setDummyCredentials();
    cy.toggleCredentialsSection();
    cy.refreshCredentials();

    cy.findUniqueInPublisherWebview(
      '[data-automation="dummy-credential-one-list"]',
    ).then(($credRecord) => {
      cy.wrap($credRecord).should("be.visible").trigger("mouseover");
      cy.wrap($credRecord)
        .find('[aria-label="Delete Credential"]')
        .click({ force: true });
    });

    cy.get(".dialog-buttons").findByText("Delete").should("be.visible").click();
    cy.get('[data-automation="dummy-credential-one-list"]').should("not.exist");
  });
});
