// Copyright (C) 2025 by Posit Software, PBC.

describe("Multi-Stepper Negative Cases", () => {
  // Global setup - run once for entire test suite
  before(() => {
    cy.initializeConnect();
    cy.visit("/");
    cy.getPublisherSidebarIcon().click();
    cy.waitForPublisherIframe();
    const user = Cypress.env("pccConfig").pcc_user_ccqa3;
    // Set up PCC credentials programmatically (no manual login)
    cy.setPCCCredential(user);
  });

  beforeEach(() => {
    cy.visit("/");
    cy.getPublisherSidebarIcon().click();
    cy.waitForPublisherIframe();
    cy.debugIframes();
  });

  describe("User Cancellation Cases", () => {
    it("OAuth error handling and cancellation scenarios", () => {
      // Tests OAuth cancellation scenarios:
      // - OAuth cancellation when adding credential (with existing credentials)
      // - OAuth cancellation from clean slate (no existing credentials)
      // - Verifies proper cleanup and state management in both scenarios

      // SCENARIO 1: OAuth cancellation when adding second credential
      cy.toggleCredentialsSection();
      cy.clickSectionAction("New Credential");
      cy.get(".quick-input-widget").should("be.visible");

      cy.get(".quick-input-titlebar").should(
        "have.text",
        "Create a New Credential",
      );

      cy.get(".quick-input-list-row")
        .contains("Posit Connect Cloud")
        .should("be.visible")
        .click();

      cy.get(".monaco-dialog-box")
        .should("be.visible")
        .should("have.attr", "aria-modal", "true");

      // Handle OAuth popup window
      cy.window().then((win) => {
        cy.stub(win, "open")
          .callsFake((url) => {
            win.oauthUrl = url;
            const mockWindow = {
              closed: false,
              close: function () {
                this.closed = true;
                setTimeout(() => {
                  win.dispatchEvent(new Event("focus"));
                }, 100);
              },
              focus: () => {},
              postMessage: () => {},
            };
            win.mockOAuthWindow = mockWindow;
            return mockWindow;
          })
          .as("windowOpen");
      });

      // Click "Open" to start OAuth flow
      cy.get(".monaco-dialog-box .dialog-buttons a.monaco-button")
        .contains("Open")
        .should("be.visible")
        .click();

      cy.get("@windowOpen").should("have.been.calledOnce");

      // Simulate OAuth cancellation: close window without completing auth
      cy.task("closeOAuthWindow", {});

      // User hits ESC to cancel the ongoing OAuth polling in VS Code
      cy.get("body").type("{esc}");

      // Ensure credentials list reflects the pre-existing PCC credential
      cy.refreshCredentials();
      cy.toggleCredentialsSection();
      cy.findUniqueInPublisherWebview('[data-automation="pcc-credential-list"]')
        .find(".tree-item-title")
        .should("have.text", "pcc-credential");

      cy.expectPollingDialogGone();

      // SCENARIO 2: OAuth cancellation from clean slate
      cy.resetCredentials();
      cy.refreshCredentials();

      // Restore the window.open stub before creating a new one
      cy.window().then((win) => {
        if (win.open && win.open.restore) {
          win.open.restore();
        }
      });

      cy.startPCCOAuthFlow();

      // Click "Open" to start OAuth flow
      cy.get(".monaco-dialog-box .dialog-buttons a.monaco-button")
        .contains("Open")
        .should("be.visible")
        .click();

      cy.get("@windowOpen").should("have.been.called");

      // Simulate user canceling by closing OAuth window
      cy.window().then((win) => {
        if (win.mockOAuthWindow) {
          win.mockOAuthWindow.close();
        }
      });

      // User hits ESC to cancel OAuth polling
      cy.get("body").type("{esc}");

      // Verify clean state after cancellation
      cy.get(".monaco-dialog-box").should("not.exist");
      cy.toggleCredentialsSection();
      cy.expectCredentialsSectionEmpty();
      cy.expectPollingDialogGone();
    });

    it("Deployment creation cancellation with partial input", () => {
      // Tests cancellation during deployment creation workflow
      // - Starts deployment creation flow
      // - Enters partial input (deployment title)
      // - Cancels via ESC key
      // - Verifies return to initial publisher state with no artifacts

      cy.startDeploymentCreationFlow("simple.py");

      // Start typing title but then cancel
      cy.get(".quick-input-widget")
        .find(".quick-input-filter input")
        .type("test-deployment");

      cy.cancelQuickInput();
      cy.expectInitialPublisherState();
    });
  });
});
