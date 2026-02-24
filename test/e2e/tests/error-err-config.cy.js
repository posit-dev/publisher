// Copyright (C) 2025 by Posit Software, PBC.

// Purpose: Validate error rendering for pre-baked misconfigured deployments.
// - "Config is invalid": shows a specific validation error message.
// - "Config is missing": shows a specific "not found" message.

// NOTE:: The error cases are created here by using pre-created files.
// Because of this, they are not suitable for deployment (due to their hard-coded values)

// Uses text-scoped queries with retry to avoid brittle DOM chains.
describe("Detect errors in config", () => {
  // Global setup - run once for entire test suite
  before(() => {
    cy.clearupDeployments();
    cy.setAdminCredentials();
  });

  beforeEach(() => {
    // Light navigation only
    cy.visit("/");
    cy.getPublisherSidebarIcon().click();
    cy.waitForPublisherIframe();
    cy.debugIframes();
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

    // Wait for deployment list to populate before searching for specific item
    cy.get(".quick-input-widget .quick-input-list-row").should("exist");

    // select our error case
    cy.get(".quick-input-widget")
      .contains("Unknown Title • Error in quarto-project-8G2B")
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

    // Wait for deployment list to populate before searching for specific item
    cy.get(".quick-input-widget .quick-input-list-row").should("exist");

    // select our error case
    cy.get(".quick-input-widget")
      .contains("Unknown Title Due to Missing Config fastapi-simple-DHJL")
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
