// Copyright (C) 2025 by Posit Software, PBC.

// Purpose: Validate error rendering for pre-baked misconfigured deployments.
// - "Config is invalid": shows a specific validation error message.
// - "Config is missing": shows a specific "not found" message.

// NOTE:: The error cases are created here by using pre-created files.
// Because of this, they are not suitable for deployment (due to their hard-coded values)

// Uses text-scoped queries with retry to avoid brittle DOM chains.
describe("Detect errors in config", () => {
  before(() => {
    cy.clearupDeployments();
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

    // Filter the quickpick to the target deployment, then select it.
    // The quickpick uses a virtualized list that only renders visible rows.
    // In CI, prior tests may leave extra deployments that push error entries
    // below the fold. Typing into the filter narrows the list so the target
    // item is rendered in the DOM and clickable.
    cy.get(".quick-input-widget input").type("quarto-project-8G2B");
    cy.get(
      '.quick-input-list .monaco-list-row[aria-label*="quarto-project-8G2B"]',
      { timeout: 20000 },
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

    // Filter the quickpick to the target deployment, then select it.
    // (See comment in first test for rationale.)
    cy.get(".quick-input-widget input").type("fastapi-simple-DHJL");
    cy.get(
      '.quick-input-list .monaco-list-row[aria-label*="fastapi-simple-DHJL"]',
      { timeout: 20000 },
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
