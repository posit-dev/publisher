// Copyright (C) 2026 by Posit Software, PBC.

// Purpose: Verify switching between multiple deployments.
// - Creates a deployment for static content.
// - Creates a second deployment for fastapi-simple.
// - Switches back to the first deployment via the deployment picker.
// - Asserts the entrypoint-label text changes to match the selected deployment.
describe("Multi-Deployment Switching Section", () => {
  before(() => {
    cy.initializeConnect();
  });

  beforeEach(() => {
    cy.visit("/");
    cy.getPublisherSidebarIcon().click();
    cy.waitForPublisherIframe();
    cy.debugIframes();
  });

  afterEach(() => {
    cy.clearupDeployments("static");
    cy.clearupDeployments("fastapi-simple");
  });

  it("Switch between two deployments via picker", () => {
    cy.skipIfConnectVersionBefore("2025.03");

    cy.expectInitialPublisherState();

    // Step 1: Create first deployment (static)
    cy.createPCSDeployment(
      "static",
      "index.html",
      "static-multi-test",
      (tomlFiles) => {
        const { contents: config } = tomlFiles.config;
        expect(config.title).to.equal("static-multi-test");
        expect(config.type).to.equal("html");
        return tomlFiles;
      },
    );

    // Step 2: Verify first deployment is shown in entrypoint-label
    cy.findInPublisherWebview('[data-automation="entrypoint-label"]').should(
      "contain.text",
      "static-multi-test",
    );

    // Step 3: Create second deployment (fastapi-simple) via the deployment picker
    cy.publisherWebview()
      .find(".deployment-control")
      .first()
      .then((control) => {
        Cypress.$(control).trigger("click");
      });

    cy.get(".quick-input-widget").should("be.visible");
    cy.get(".quick-input-titlebar").should("have.text", "Select Deployment");
    cy.get(".quick-input-list")
      .find('[aria-label*="Create a New Deployment"]')
      .should("be.visible")
      .click();

    // Select entrypoint for second deployment
    cy.retryWithBackoff(
      () =>
        cy
          .get(".quick-input-widget")
          .find(
            '[aria-label="fastapi-simple/fastapi-main.py, Open Files"], [aria-label="fastapi-main.py, Open Files"]',
          ),
      10,
      700,
    ).then(($el) => {
      cy.wrap($el).scrollIntoView();
      cy.wrap($el).click({ force: true });
    });

    // Wait for title step and enter title
    cy.retryWithBackoff(
      () =>
        cy
          .get(".quick-input-widget")
          .find(".quick-input-message")
          .then(($m) => {
            const txt = ($m.text() || "").toLowerCase();
            return /title|name/.test(txt) ? $m : Cypress.$();
          }),
      10,
      700,
    );

    cy.get(".quick-input-widget")
      .find(".quick-input-filter input")
      .then(($input) => {
        const el = $input[0];
        el.value = "";
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.value = "fastapi-multi-test";
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });

    cy.get(".quick-input-widget")
      .find(".quick-input-filter input")
      .should("have.value", "fastapi-multi-test");

    cy.get(".quick-input-widget").type("{enter}");

    // Select credential
    cy.get(
      '.quick-input-widget .monaco-list-row[aria-label*="admin-code-server"]',
    )
      .first()
      .click({ force: true });

    // Step 4: Verify second deployment is now selected
    cy.findInPublisherWebview('[data-automation="entrypoint-label"]').should(
      "contain.text",
      "fastapi-multi-test",
    );

    // Step 5: Switch back to first deployment via picker
    cy.publisherWebview()
      .find(".deployment-control")
      .first()
      .then((control) => {
        Cypress.$(control).trigger("click");
      });

    cy.get(".quick-input-widget").should("be.visible");
    cy.get(".quick-input-titlebar").should("have.text", "Select Deployment");

    // Select the first deployment (static-multi-test)
    cy.get(".quick-input-list")
      .find('[aria-label*="static-multi-test"]')
      .should("be.visible")
      .click();

    // Step 6: Verify first deployment is shown again
    cy.findInPublisherWebview('[data-automation="entrypoint-label"]').should(
      "contain.text",
      "static-multi-test",
    );
  });
});
