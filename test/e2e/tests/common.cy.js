// Copyright (C) 2025 by Posit Software, PBC.

describe("Common", () => {
  beforeEach(() => {
    cy.visit("/");
  });

  it("Publisher extension can be selected and initial state", () => {
    cy.getPublisherSidebarIcon()
      .should("be.visible", { timeout: 10000 })
      .click();
    cy.waitForPublisherIframe(); // Wait after triggering extension
    cy.debugIframes();
    cy.findByText("Posit Publisher: Home").should("exist");
    cy.publisherWebview()
      .findByTestId("publisher-deployment-section")
      .should("exist");
    cy.publisherWebview()
      .findByTestId("publisher-credentials-section")
      .should("exist");
    cy.debugIframes();
    cy.publisherWebview().then((body) => {
      cy.task("print", body.innerHTML);
    });
    cy.publisherWebview()
      .findByTestId("publisher-help-section")
      .should("exist");
  });
});
