// Commands to serve as utility selectors
// mainly to help through Cypress + iframes limitations.

// Get the main webview iframe of the Publisher extension.
Cypress.Commands.add("publisherWebview", () => {
  function findPublisherIframe(retries = 90) {
    // double the retries for more robustness
    return cy
      .get("iframe.webview.ready", { timeout: 20000 }) // double the timeout for each attempt
      .then(($iframes) => {
        cy.task("print", `Found ${$iframes.length} webview.ready iframes`);
        const $target = Cypress.$($iframes).filter((i, el) =>
          (el.src || "").includes("extensionId=posit.publisher"),
        );
        cy.task("print", `Found ${$target.length} publisher iframes`);
        if ($target.length === 0 && retries > 0) {
          // eslint-disable-next-line cypress/no-unnecessary-waiting
          cy.wait(2000);
          return findPublisherIframe(retries - 1);
        }
        if ($target.length === 0 && retries === 0) {
          cy.task(
            "print",
            "Max retries reached: publisher iframe never appeared",
          );
        }
        expect(
          $target.length,
          "publisher webview iframe present",
        ).to.be.greaterThan(0);
        return cy.wrap($target[0].contentDocument.body);
      });
  }
  return findPublisherIframe()
    .should("not.be.empty")
    .then(cy.wrap)
    .find("iframe#active-frame", { timeout: 20000 })
    .its("0.contentDocument.body")
    .should("not.be.empty")
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
