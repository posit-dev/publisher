// Commands to serve as utility selectors
// mainly to help through Cypress + iframes limitations.

// Get the main webview iframe of the Publisher extension.
Cypress.Commands.add("publisherWebview", () => {
  return cy
    .get("iframe.webview.ready")
    .its("0.contentDocument.body")
    .should("not.be.empty")
    .then(cy.wrap)
    .find("iframe")
    .its("0.contentDocument.body")
    .should((body) => {
      expect(Cypress.$(body).has("#app").length).gt(0);
    })
    .then(cy.wrap);
});

Cypress.Commands.add("getPublisherSidebarIcon", () => {
  return cy.findByLabelText("Posit Publisher", {
    selector: ".codicon-posit-publisher-publish",
  });
});

Cypress.Commands.add("toggleCredentialsSection", () => {
  // Due to Cypress + iframes limited support,
  // clicking the section title needs to be done with jQuery elements
  // Cypress chained click() method will fail in this case.
  cy.publisherWebview()
    .findByTestId("publisher-credentials-section")
    .should((section) => {
      expect(Cypress.$(section).find(".title").text()).to.equal("Credentials");
      Cypress.$(section).find(".title").trigger("click");
    });
});

Cypress.Commands.add("toggleHelpSection", () => {
  // Due to Cypress + iframes limited support,
  // clicking the section title needs to be done with jQuery elements
  // Cypress chained methods will fail in this case.
  cy.publisherWebview()
    .findByTestId("publisher-help-section")
    .should((section) => {
      expect(Cypress.$(section).find(".title").text()).to.equal(
        "Help and Feedback",
      );
      Cypress.$(section).find(".title").trigger("click");
    });
});

Cypress.Commands.add("clickSectionAction", (actionLabel) => {
  // Due to Cypress + iframes limited support,
  // clicking section actions needs to be done with jQuery elements
  // Cypress chained methods will fail in this case.

  // In addition, there is something with the actions that aparrently
  // the only way to trigger clicks on them is to use vanilla JS click method.
  // Nor Cypress nor jQuery methods succeed in this space.
  cy.publisherWebview()
    .findByTestId("publisher-credentials-section")
    .then((section) => {
      Cypress.$(section).find(".pane-header").trigger("focus");
      Cypress.$(section).find(`[aria-label="${actionLabel}"]`)[0].click();
    });
});

Cypress.Commands.add("findInPublisherWebview", (selector) => {
  // Method to solve a common error while traversing or finding DOM elements within Cypress,
  // due to Cypress + iframes limited support.
  // "TypeError: Timed out retrying after 4000ms: Cannot read properties of undefined (reading 'scrollY')"
  cy.publisherWebview().then((webview) => {
    return Cypress.$(webview).find(selector);
  });
});
