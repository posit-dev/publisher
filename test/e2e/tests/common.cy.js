// Copyright (C) 2025 by Posit Software, PBC.

// Purpose: Smoke-test that the Publisher extension loads, the webview is accessible,
// and all primary sections appear (Deployments, Credentials, Help).
// This is a fast readiness check used by other specs as a baseline.
describe("Common", () => {
  beforeEach(() => {
    cy.visit("/");
    cy.getPublisherSidebarIcon().click();
    cy.waitForPublisherIframe();
    cy.debugIframes();
  });

  it("Publisher extension can be selected and initial state", () => {
    // Validates basic webview readiness and presence of core sections.
    cy.expectInitialPublisherState();

    cy.findUniqueInPublisherWebview(
      '[data-automation="publisher-deployment-section"]',
    ).should("exist");

    cy.findUniqueInPublisherWebview(
      '[data-automation="publisher-credentials-section"]',
    ).should("exist");

    cy.findUniqueInPublisherWebview(
      '[data-automation="publisher-help-section"]',
    ).should("exist");
  });
});
