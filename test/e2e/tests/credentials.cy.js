// Copyright (C) 2025 by Posit Software, PBC.

describe("Credentials Section", () => {
  beforeEach(() => {
    cy.resetConnect();
    cy.resetCredentials();
    cy.visit("/");
  });

  it("New Connect Server Credential", () => {
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

    cy.get(".notifications-toasts")
      .should("be.visible")
      .findByText("Successfully connected to http://connect-publisher-e2e:3939")
      .should("be.visible");

    cy.get(".quick-input-message", { timeout: 10000 }).should(
      "include.text",
      "Enter a unique nickname for this server.",
    );

    cy.get(".quick-input-widget").type("admin-code-server{enter}");

    cy.findInPublisherWebview('[data-automation="admin-code-server-list"]')
      .find(".tree-item-title")
      .should("have.text", "admin-code-server");
  });

  it("New Connect Cloud Credential - OAuth Device Code", () => {
    const user = Cypress.env("pccConfig").pcc_user_ccqa3;
    cy.getPublisherSidebarIcon()
      .should("be.visible", { timeout: 10000 })
      .click();

    cy.toggleCredentialsSection();
    cy.publisherWebview()
      .findByText("No credentials have been added yet.")
      .should("be.visible");

    cy.clickSectionAction("New Credential");
    cy.get(".quick-input-widget").should("be.visible");

    cy.get(".quick-input-titlebar")
      .should("have.text", "Create a New Credential")
      .click();

    cy.get(
      'input[aria-label*="Please select the platform for the new credential."]',
    ).should(
      "have.attr",
      "placeholder",
      "Please select the platform for the new credential.",
    );

    cy.get(".quick-input-list-row")
      .contains("Posit Connect Cloud")
      .should("be.visible")
      .click();

    // Wait for the dialog box to appear and be visible
    cy.get(".monaco-dialog-box", { timeout: 10000 })
      .should("be.visible")
      .should("have.attr", "aria-modal", "true");

    // Handle the OAuth popup window BEFORE clicking Open
    cy.window().then((win) => {
      // Override window.open to simulate the popup behavior
      cy.stub(win, "open")
        .callsFake((url) => {
          // Store the OAuth URL for later use
          win.oauthUrl = url;
          console.log("OAuth URL captured:", url);

          // Create a mock window object that will simulate closing after OAuth
          const mockWindow = {
            closed: false,
            close: function () {
              this.closed = true;
              // Notify the extension that the popup has closed (OAuth completed)
              setTimeout(() => {
                win.dispatchEvent(new Event("focus"));
                console.log(
                  "OAuth popup closed - extension should check for completion",
                );
              }, 100);
            },
            focus: () => {},
            postMessage: () => {},
          };

          // Store the mock window for later use
          win.mockOAuthWindow = mockWindow;

          return mockWindow;
        })
        .as("windowOpen");
    });

    // Click the "Open" button to start the OAuth flow
    cy.get(".monaco-dialog-box .dialog-buttons a.monaco-button")
      .contains("Open")
      .should("be.visible")
      .click();

    // Wait for window.open to be called
    cy.get("@windowOpen").should("have.been.called");

    // Run the OAuth task with VS Code's captured URL and loaded user credentials
    cy.window().then((win) => {
      cy.task(
        "authenticateOAuthDevice",
        {
          email: user.email,
          password: user.auth.password,
          oauthUrl: win.oauthUrl, // Pass VS Code's OAuth URL to Playwright
        },
        { timeout: 60000 },
      );
    });

    // Wait for OAuth completion and VS Code to detect it
    cy.get(".monaco-dialog-box").should("not.exist", { timeout: 30000 });

    cy.get(".notifications-toasts")
      .should("be.visible")
      .findByText("Successfully connected to Connect Cloud 🎉")
      .should("be.visible");

    // Wait for the nickname input field to appear
    cy.get(".quick-input-message", { timeout: 15000 }).should(
      "include.text",
      "Enter a unique nickname for this account.",
    );

    // Continue with credential creation after OAuth success
    cy.get(".quick-input-and-message input", { timeout: 5000 })
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

    cy.findInPublisherWebview('[data-automation="dummy-credential-one-list"]')
      .find(".tree-item-title", { timeout: 10000 })
      .should("exist")
      .and("have.text", "dummy-credential-one");

    cy.findInPublisherWebview('[data-automation="dummy-credential-two-list"]')
      .find(".tree-item-title", { timeout: 10000 })
      .should("exist")
      .and("have.text", "dummy-credential-two");
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
