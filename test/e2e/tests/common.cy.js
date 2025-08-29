// Copyright (C) 2025 by Posit Software, PBC.

describe("Common", () => {
  beforeEach(() => {
    cy.visit("/");
  });

  it("Publisher extension can be selected and initial state", () => {
    cy.getPublisherSidebarIcon().should("be.visible").click();
    cy.waitForPublisherIframe(); // Wait after triggering extension
    cy.debugIframes();
    cy.retryWithBackoff(
      () => cy.findByText("Posit Publisher: Home"),
      5,
      500,
    ).should("exist");
    cy.retryWithBackoff(
      () =>
        cy.findUniqueInPublisherWebview(
          '[data-automation="publisher-deployment-section"]',
        ),
      5,
      500,
    ).should("exist");
    cy.retryWithBackoff(
      () =>
        cy.findUniqueInPublisherWebview(
          '[data-automation="publisher-credentials-section"]',
        ),
      5,
      500,
    ).should("exist");
    cy.debugIframes();
    cy.publisherWebview().then((body) => {
      cy.task("print", body.innerHTML);
    });
    cy.retryWithBackoff(
      () =>
        cy.findUniqueInPublisherWebview(
          '[data-automation="publisher-help-section"]',
        ),
      5,
      500,
    ).should("exist");
  });
});
