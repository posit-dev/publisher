describe("IntegrationRequests Section", () => {
  beforeEach(() => {
    cy.resetConnect();
    cy.resetCredentials();
    cy.visit("/");
  });

  afterEach(() => {
    cy.clearupDeployments("static");
  });

  it("Connect Cloud should not display IntegrationRequests", () => {

    // first create a Connect Cloud credential via OAuth
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
    cy.get(".quick-input-list-row")
      .contains("Posit Connect Cloud")
      .should("be.visible")
      .click();

    cy.get(".monaco-dialog-box", { timeout: 10000 })
      .should("be.visible")
      .should("have.attr", "aria-modal", "true");

    cy.window().then((win) => {
      cy.stub(win, "open")
        .callsFake((url) => {
          win.oauthUrl = url;
          console.log("OAuth URL captured:", url);
          const mockWindow = {
            closed: false,
            close: function () {
              this.closed = true;
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
          win.mockOAuthWindow = mockWindow;
          return mockWindow;
        })
        .as("windowOpen");
    });

    cy.get(".monaco-dialog-box .dialog-buttons a.monaco-button")
      .contains("Open")
      .should("be.visible")
      .click();

    cy.get("@windowOpen").should("have.been.called");

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

    cy.get(".monaco-dialog-box").should("not.exist", { timeout: 30000 });

    cy.get(".quick-input-message", { timeout: 15000 }).should(
      "include.text",
      "Enter a unique nickname for this account.",
    );
    cy.get(".quick-input-widget").type("connect-cloud-deployment-test{enter}");

    cy.findInPublisherWebview(
      '[data-automation="connect-cloud-deployment-test-list"]',
    )
      .find(".tree-item-title")
      .should("have.text", "connect-cloud-deployment-test");

    // modified from the createDeployment function
    cy.getPublisherSidebarIcon()
      .should("be.visible", { timeout: 10000 });

    // Small wait to allow the UI to settle in CI before proceeding
    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(1000);

    // create a new deployment via the select-deployment button
    cy.publisherWebview()
      .findByTestId("select-deployment")
      .then((dplyPicker) => {
        Cypress.$(dplyPicker).trigger("click");
      });

    // Ux displayed via quick input
    // This has taken longer than 4 seconds on some laptops, so we're increasing
    // the timeout
    cy.get(".quick-input-widget", { timeout: 10000 }).should("be.visible");
    cy.get(".quick-input-titlebar").should("have.text", "Select Deployment");
    cy.get(".quick-input-list")
      .find(
        '[aria-label="Create a New Deployment, (or pick one of the existing deployments below), New"]',
      )
      .should("be.visible")
      .click();

    cy.get(".quick-input-widget")
      .contains("Open...")
      .should("be.visible")
      .click();

    cy.get(".quick-input-widget")
      .find('[aria-label="static"')
      .should("be.visible")
      .click();

    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(500);

    cy.get(".quick-input-widget")
      .find('[aria-label="index.html"')
      .should("be.visible")
      .click();

    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(500);

    cy.get(".quick-input-widget")
      .find(".quick-input-filter input")
      .type(`static{enter}`);

    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(500);

    cy.get(".quick-input-widget")
      .contains("connect-cloud-deployment-test")
      .should("be.visible")
      .click();

    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(500);

    cy.publisherWebview()
      .findByText("IntegrationRequests")
      .should("not.exist");
  });
});
