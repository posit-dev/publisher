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

    // Step 3: Open fastapi-main.py so it appears in "Open Files" for entrypoint selection
    cy.get("a.codicon-explorer-view-icon").first().click();
    cy.get(".explorer-viewlet").should("be.visible");
    cy.retryWithBackoff(
      () =>
        cy.get(".explorer-viewlet").then(($explorer) => {
          const target = $explorer.find('[aria-label="fastapi-simple"]');
          if (target.length > 0) {
            const isExpanded = target.attr("aria-expanded") === "true";
            if (!isExpanded) {
              target[0].click();
            }
            const entrypoint = $explorer.find('[aria-label="fastapi-main.py"]');
            return entrypoint.length > 0 ? entrypoint : Cypress.$();
          }
          return Cypress.$();
        }),
      10,
      700,
    );
    cy.get(".explorer-viewlet")
      .find('[aria-label="fastapi-main.py"]')
      .should("be.visible")
      .dblclick();
    cy.retryWithBackoff(
      () =>
        cy.get(".tabs-container").then(($tabs) => {
          return $tabs.find('[aria-label="fastapi-main.py"]');
        }),
      10,
      700,
    ).should("be.visible");

    // Step 4: Create second deployment via the deployment picker
    cy.getPublisherSidebarIcon().click();
    cy.publisherWebview()
      .find(".deployment-control")
      .first()
      .then((control) => {
        Cypress.$(control).trigger("click");
      });

    cy.get(".quick-input-widget").should("be.visible");
    cy.get(".quick-input-titlebar").should("have.text", "Select Deployment");

    // Type "Create" in the filter to find the item (virtual scrolling may hide it)
    cy.get(".quick-input-widget .quick-input-filter input").type("Create");
    cy.get(".quick-input-list")
      .find('[aria-label*="Create a New Deployment"]')
      .should("be.visible")
      .click();

    // Select entrypoint for second deployment
    cy.retryWithBackoff(
      () =>
        cy.get(".quick-input-widget").then(($widget) => {
          return $widget.find(
            '[aria-label="fastapi-simple/fastapi-main.py, Open Files"], [aria-label="fastapi-main.py, Open Files"]',
          );
        }),
      10,
      1000,
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

    // Step 5: Wait for deployment creation to complete and webview to update
    cy.waitForNetworkIdle(1000);
    cy.retryWithBackoff(
      () =>
        cy.publisherWebview().then(($body) => {
          return $body.find('[data-automation="entrypoint-label"]');
        }),
      10,
      1000,
    ).should("contain.text", "fastapi-multi-test");

    // Step 6: Switch back to first deployment via picker
    cy.publisherWebview()
      .find(".deployment-control")
      .first()
      .then((control) => {
        Cypress.$(control).trigger("click");
      });

    cy.get(".quick-input-widget").should("be.visible");
    cy.get(".quick-input-titlebar").should("have.text", "Select Deployment");

    // Select the first deployment (type in filter to handle virtual scrolling)
    cy.get(".quick-input-widget .quick-input-filter input").type(
      "static-multi-test",
    );
    cy.get(".quick-input-list")
      .find('[aria-label*="static-multi-test"]')
      .should("be.visible")
      .first()
      .click();

    // Step 7: Verify first deployment is shown again (wait for webview update)
    cy.waitForNetworkIdle(1000);
    cy.retryWithBackoff(
      () =>
        cy.publisherWebview().then(($body) => {
          return $body.find('[data-automation="entrypoint-label"]');
        }),
      10,
      1000,
    ).should("contain.text", "static-multi-test");
  });
});
