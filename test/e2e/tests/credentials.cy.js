// Copyright (C) 2025 by Posit Software, PBC.

// Purpose: Validate credential creation, listing, and deletion flows for PCS and PCC.
// - New PCS Credential: full guided UI flow using API key.
// - New PCC Credential: OAuth Device Code flow with Playwright automation.
// - Existing Credentials Load: ensure listing reflects existing file-managed records.
// - Delete Credential: verify deletion from UI with hover-only button.
describe("Credentials Section", () => {
  // Global setup - run once for entire test suite
  before(() => {
    cy.resetConnect();
    cy.setAdminCredentials(); // Set up admin credential once
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

  it("New PCC Credential - OAuth Device Code", () => {
    const user = Cypress.env("pccConfig").pcc_user_ccqa3;
    // Starts the PCC OAuth modal and stubs window.open, then runs Playwright device flow.
    // Asserts successful connection, then saves a nickname and verifies it in the tree.

    // Use helper to expand section, start flow, select PCC, show OAuth dialog, and stub window.open
    cy.startPCCOAuthFlow();

    // Click the "Open" button to start the OAuth flow
    cy.get(".monaco-dialog-box .dialog-buttons a.monaco-button")
      .contains("Open")
      .should("be.visible")
      .click();

    // Ensure window.open was called
    cy.get("@windowOpen").should("have.been.called");

    // Authenticate via Playwright using the captured VS Code OAuth URL
    cy.window().then((win) => {
      cy.task(
        "authenticateOAuthDevice",
        {
          email: user.email,
          password: user.auth.password,
          oauthUrl: win.oauthUrl,
        },
        { timeout: 60000 },
      );
    });

    // Wait for OAuth completion and VS Code to detect it
    cy.get(".monaco-dialog-box").should("not.exist", { timeout: 30000 });

    cy.get(".quick-input-message", { timeout: 15000 }).should(
      "include.text",
      "Successfully connected to Connect Cloud 🎉",
    );

    // Wait for the nickname input field to appear
    cy.get(".quick-input-message", { timeout: 15000 }).should(
      "include.text",
      "Enter a unique nickname for this account.",
    );

    // Continue with credential creation after OAuth success
    cy.get(".quick-input-and-message input")
      .should("exist")
      .should("be.visible");
    cy.get(".quick-input-widget").type("connect-cloud-credential{enter}");

    cy.findInPublisherWebview(
      '[data-automation="connect-cloud-credential-list"]',
    )
      .find(".tree-item-title")
      .should("have.text", "connect-cloud-credential");
  });

  it("Existing Credentials Load", () => {
    // Seeds two dummy credentials and validates they render correctly in the list.
    // Uses retryWithBackoff + findUnique to reduce flakiness.

    cy.setDummyCredentials();
    cy.toggleCredentialsSection();
    cy.refreshCredentials();

    cy.publisherWebview()
      .findByText("No credentials have been added yet.")
      .should("not.exist");

    // Use consistent helpers with backoff for stability
    cy.retryWithBackoff(
      () =>
        cy.findUniqueInPublisherWebview(
          '[data-automation="dummy-credential-one-list"]',
        ),
      5,
      500,
    )
      .find(".tree-item-title")
      .should("exist")
      .and("have.text", "dummy-credential-one");

    cy.retryWithBackoff(
      () =>
        cy.findUniqueInPublisherWebview(
          '[data-automation="dummy-credential-two-list"]',
        ),
      5,
      500,
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

    cy.publisherWebview();
    cy.retryWithBackoff(
      () =>
        cy.findUniqueInPublisherWebview(
          '[data-automation="dummy-credential-one-list"]',
        ),
      5,
      500,
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
