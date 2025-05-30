// Copyright (C) 2025 by Posit Software, PBC.

// NOTE:: The error cases are created here by using pre-created files.
// Because of this, they are not suitable for deployment (due to their hard-coded values)

describe("Detect error in config", () => {
  beforeEach(() => {
    cy.resetConnect();
    cy.setAdminCredentials();
    cy.visit("/").debug();

    // Select the publisher extension
    cy.getPublisherSidebarIcon()
      .should("be.visible", { timeout: 10000 })
      .click();
  });

  it("Show errors when Config is invalid", () => {
    // click on the select deployment button
    cy.publisherWebview()
      .findByTestId("select-deployment")
      .then((dplyPicker) => {
        Cypress.$(dplyPicker).trigger("click");
      });

    cy.get(".quick-input-widget").should("be.visible");

    cy.get(".quick-input-titlebar").should("have.text", "Select Deployment");

    // select our error case. This confirms that we have it.
    cy.get(".quick-input-widget")
      .contains("Unknown Title • Error in quarto-project-8G2B")
      .click();

    // confirm that the selector shows the error
    cy.publisherWebview()
      .findByTestId("publisher-deployment-section")
      .find(".deployment-control")
      .find(".quick-pick-option")
      .find(".quick-pick-row")
      .find(".quick-pick-label-container")
      .find(".quick-pick-label")
      .should("have.text", "Unknown Title • Error in quarto-project-8G2B");

    // confirm that we also have an error section
    cy.publisherWebview()
      .findByTestId("publisher-deployment-section")
      .find(
        'p:contains("The selected Configuration has a schema error on line 17.")',
      );
  });

  it("Show errors when Config is missing", () => {
    // click on the select deployment button
    cy.publisherWebview()
      .findByTestId("select-deployment")
      .then((dplyPicker) => {
        Cypress.$(dplyPicker).trigger("click");
      });

    cy.get(".quick-input-widget").should("be.visible");

    cy.get(".quick-input-titlebar").should("have.text", "Select Deployment");

    // select our error case. This confirms that we have it.
    cy.get(".quick-input-widget")
      .contains("Unknown Title Due to Missing Config fastapi-simple-DHJL")
      .click();

    // confirm that the selector shows the error
    cy.publisherWebview()
      .findByTestId("publisher-deployment-section")
      .find(".deployment-control")
      .find(".quick-pick-option")
      .find(".quick-pick-row")
      .find(".quick-pick-label-container")
      .find(".quick-pick-label")
      .should(
        "have.text",
        "Unknown Title Due to Missing Config fastapi-simple-DHJL",
      );

    // confirm that we also have an error section
    cy.publisherWebview()
      .findByTestId("publisher-deployment-section")
      .find(
        'p:contains("The last Configuration used for this Deployment was not found.")',
      );
  });
});
