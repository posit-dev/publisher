describe("Common", () => {
  it("Publisher extension can be selected and initial state", () => {
    cy.visit("/");
    cy.getPublisherSidebarIcon()
      .should("be.visible", { timeout: 10000 })
      .click();
    cy.findByText("Posit Publisher: Home").should("exist");
    cy.publisherWebview()
      .findByTestId("publisher-deployment-section")
      .should("exist");
    cy.publisherWebview()
      .findByTestId("publisher-credentials-section")
      .should("exist");
    cy.publisherWebview()
      .findByTestId("publisher-help-section")
      .should("exist");
  });
});
