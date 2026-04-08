// Copyright (C) 2025 by Posit Software, PBC.

// Purpose: Validate error rendering for pre-baked misconfigured deployments.
// - "Config is invalid": shows a specific validation error message.
// - "Config is missing": shows a specific "not found" message.

// NOTE:: The error cases are created here by using pre-created files.
// Because of this, they are not suitable for deployment (due to their hard-coded values)

// Uses text-scoped queries with retry to avoid brittle DOM chains.
describe("Detect errors in config", () => {
  before(() => {
    // Log state of config-errors files BEFORE cleanup (host filesystem)
    cy.exec(
      'find content-workspace/config-errors -type f -name "*.toml" 2>/dev/null || echo "NONE"',
    ).then((result) => {
      cy.task("print", `[BEFORE cleanup] host config-errors: ${result.stdout}`);
    });

    cy.clearupDeployments();

    // Log state AFTER cleanup — both host and container views
    cy.exec(
      'find content-workspace/config-errors -type f -name "*.toml" 2>/dev/null || echo "NONE"',
    ).then((result) => {
      cy.task("print", `[AFTER cleanup] host config-errors: ${result.stdout}`);
    });
    cy.exec(
      'find content-workspace -type d -name ".posit" 2>/dev/null || echo "NONE"',
    ).then((result) => {
      cy.task("print", `[AFTER cleanup] host .posit dirs: ${result.stdout}`);
    });
    // Check what the code-server container actually sees
    cy.exec(
      'docker exec publisher-e2e.code-server find /home/coder/workspace/config-errors -type f -name "*.toml" 2>/dev/null || echo "NONE"',
      { failOnNonZeroExit: false },
    ).then((result) => {
      cy.task(
        "log",
        `[AFTER cleanup] container config-errors: ${result.stdout}`,
      );
    });
  });

  beforeEach(() => {
    cy.visit("/");
    cy.getPublisherSidebarIcon().click();
    cy.waitForPublisherIframe();
    cy.debugIframes();
    cy.resetCredentials();
    cy.setAdminCredentials();
  });

  it("Show errors when Config is invalid", () => {
    // Selects error deployment and asserts the quick-pick label appears,
    // then verifies the detailed error paragraph is present.

    // Ensure Publisher is in the expected initial state
    cy.expectInitialPublisherState();

    // click on the select deployment button
    cy.publisherWebview()
      .findByTestId("select-deployment")
      .then((dplyPicker) => {
        Cypress.$(dplyPicker).trigger("click");
      });

    cy.get(".quick-input-widget").should("be.visible");
    cy.get(".quick-input-titlebar").should("have.text", "Select Deployment");

    // Select the error deployment using aria-label matching with Cypress's
    // built-in retry. Use a long timeout for CI where item rendering is slow.
    cy.get(
      '.quick-input-list .monaco-list-row[aria-label*="quarto-project-8G2B"]',
      { timeout: 30000 },
    )
      .should("be.visible")
      .click();

    // confirm that the selector shows the error
    cy.findUniqueInPublisherWebview(
      '[data-automation="publisher-deployment-section"] .quick-pick-label:contains("Unknown Title • Error in quarto-project-8G2B")',
    ).should("be.visible");

    // confirm that we also have an error section
    cy.findUniqueInPublisherWebview(
      '[data-automation="publisher-deployment-section"] p:contains("The selected Configuration has an error: invalidParam: not allowed.")',
    ).should("exist");
  });

  it("Show errors when Config is missing", () => {
    // Selects missing-config deployment and asserts the quick-pick label appears,
    // then verifies the detailed "not found" error paragraph is present.

    // Ensure Publisher is in the expected initial state
    cy.expectInitialPublisherState();

    // click on the select deployment button
    cy.publisherWebview()
      .findByTestId("select-deployment")
      .then((dplyPicker) => {
        Cypress.$(dplyPicker).trigger("click");
      });

    cy.get(".quick-input-widget").should("be.visible");
    cy.get(".quick-input-titlebar").should("have.text", "Select Deployment");

    // Select the error deployment using aria-label matching with Cypress's
    // built-in retry. Use a long timeout for CI where item rendering is slow.
    cy.get(
      '.quick-input-list .monaco-list-row[aria-label*="fastapi-simple-DHJL"]',
      { timeout: 30000 },
    )
      .should("be.visible")
      .click();

    // confirm that the selector shows the error
    cy.findUniqueInPublisherWebview(
      '[data-automation="publisher-deployment-section"] .quick-pick-label:contains("Unknown Title Due to Missing Config fastapi-simple-DHJL")',
    ).should("be.visible");

    // confirm that we also have an error section
    cy.findUniqueInPublisherWebview(
      '[data-automation="publisher-deployment-section"] p:contains("The last Configuration used for this Deployment was not found.")',
    ).should("exist");
  });
});
