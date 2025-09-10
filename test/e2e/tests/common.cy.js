// Copyright (C) 2025 by Posit Software, PBC.

describe("Common", () => {
  beforeEach(() => {
    cy.visit("/");
    cy.getPublisherSidebarIcon().click();
    cy.waitForPublisherIframe();
    cy.debugIframes();
  });

  it("Publisher extension can be selected and initial state", () => {
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
