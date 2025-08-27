// Commands to serve as utility selectors
// mainly to help through Cypress + iframes limitations.

// Get the main webview iframe of the Publisher extension.
Cypress.Commands.add("publisherWebview", () => {
  // Wait up to 60 seconds (30 retries x 2s) for the publisher iframe, then reload once and try 10 more times.
  // If still not found, log a clear error and fail the test.
  function findPublisherIframe(retries = 30, hasReloaded = false) {
    return cy
      .get("iframe.webview.ready", { timeout: 30000 })
      .then(($iframes) => {
        if (Cypress.env("DEBUG_CYPRESS") === "true") {
          cy.task("print", `Found ${$iframes.length} webview.ready iframes`);
        }
        const $target = Cypress.$($iframes).filter((i, el) =>
          (el.src || "").includes("extensionId=posit.publisher"),
        );
        if (Cypress.env("DEBUG_CYPRESS") === "true") {
          cy.task("print", `Found ${$target.length} publisher iframes`);
        }
        if ($target.length > 0) {
          expect(
            $target.length,
            "publisher webview iframe present",
          ).to.be.greaterThan(0);

          // Verify iframe has actual content
          const body = $target[0].contentDocument?.body;
          if (body) {
            const bodyText = body.innerText || "";
            const hasAutomationElements =
              body.querySelector("[data-automation]") !== null;

            if (bodyText.includes("Posit") || hasAutomationElements) {
              cy.log(
                "Publisher iframe content verified to contain expected content",
              );
            } else {
              cy.log(
                "WARNING: Publisher iframe found but content may not be fully loaded",
              );
              cy.log(`Content sample: ${bodyText.substring(0, 100)}`);
            }
          }

          return cy.wrap($target[0].contentDocument.body);
        } else if (retries > 0) {
          // eslint-disable-next-line cypress/no-unnecessary-waiting
          return cy
            .wait(2000)
            .then(() => findPublisherIframe(retries - 1, hasReloaded));
        } else if (!hasReloaded) {
          cy.log("Publisher iframe not found after retries, reloading page...");
          return cy.reload().then(() => findPublisherIframe(10, true));
        } else {
          cy.log(
            "ERROR: Publisher iframe not found after waiting and reloading. UI may not have loaded correctly. If this happens often, check Connect service health or add a backend health check before running tests.",
          );
          cy.log("Attempting extreme iframe finder as last resort...");
          // Try extreme finder as absolute last resort
          return cy.findPublisherIframeExtreme().then(($iframe) => {
            const iframe = $iframe[0];
            if (
              iframe &&
              iframe.contentDocument &&
              iframe.contentDocument.body
            ) {
              return cy.wrap(iframe.contentDocument.body);
            } else {
              throw new Error(
                "Even extreme iframe finder failed - iframe content not accessible",
              );
            }
          });
        }
      });
  }
  return findPublisherIframe()
    .should("not.be.empty")
    .then(cy.wrap)
    .find("iframe#active-frame", { timeout: 30000 })
    .its("0.contentDocument.body")
    .should("not.be.empty")
    .then((body) => {
      // We need to wrap in jQuery to use html() and text()
      const $body = Cypress.$(body);

      // Now we can safely use jQuery methods
      if ($body.length > 0) {
        const bodyText = $body.text() || "";

        if (!bodyText.includes("Posit Publisher")) {
          cy.log(
            "WARNING: Publisher webview inner content doesn't contain expected text",
          );
          cy.log(`Content preview: ${bodyText.substring(0, 200)}`);

          if (Cypress.env("DEBUG_CYPRESS") === "true") {
            const bodyHtml = $body.html() || "";
            cy.task(
              "print",
              `Publisher webview HTML: ${bodyHtml.substring(0, 500)}...`,
            );
          }
        }
      }

      return cy.wrap(body);
    });
});

// Backup publisherWebview command using extreme iframe finder
Cypress.Commands.add("publisherWebviewExtreme", () => {
  return cy
    .findPublisherIframeExtreme()
    .then(($iframe) => {
      const iframe = $iframe[0];
      if (iframe && iframe.contentDocument && iframe.contentDocument.body) {
        return cy.wrap(iframe.contentDocument.body);
      } else {
        throw new Error("Iframe content not accessible");
      }
    })
    .should("not.be.empty")
    .then(cy.wrap)
    .find("iframe#active-frame")
    .then((obj) => {
      if (obj.length === 1) {
        return cy
          .log("iframe#active-frame search found one this time")
          .wrap(obj)
          .its("0.contentDocument.body");
      }
      return cy
        .log("iframe#active-frame search found more than one", obj.length)
        .wrap(obj)
        .its("1.contentDocument.body");
    })
    .should((body) => {
      const $body = Cypress.$(body);
      expect($body.length).gt(0);
      expect($body.find("#app").length).gt(0);
    })
    .then(cy.wrap);
});

Cypress.Commands.add("getPublisherSidebarIcon", () => {
  return cy.findByLabelText("Posit Publisher", {
    selector: ".codicon-posit-publisher-publish",
    timeout: 10000,
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

Cypress.Commands.add(
  "findPublisherIframeExtreme",
  { prevSubject: false },
  () => {
    function attemptFindIframe(attempt = 1, maxAttempts = 10) {
      cy.log(`[Extreme] Iframe find attempt ${attempt}/${maxAttempts}`);

      return cy
        .get("iframe", { timeout: 10000, log: false })
        .then(($iframes) => {
          cy.log(`[Extreme] Found ${$iframes.length} iframes`);

          // Log all iframes for debugging
          $iframes.each((i, iframe) => {
            cy.log(
              `iframe[${i}] class=${iframe.className} id=${iframe.id} src=${iframe.src}`,
            );
          });

          // Try to find by publisher extension ID in src
          const $publisherIframe = $iframes.filter((i, el) => {
            return el.src && el.src.includes("extensionId=posit.publisher");
          });

          if ($publisherIframe.length > 0) {
            cy.log("[Extreme] Found publisher iframe by extensionId!");

            // Wait for iframe content to be ready with retry logic
            return cy
              .wrap($publisherIframe.eq(0))
              .its("0.contentDocument.body", { timeout: 5000 })
              .should("not.be.empty")
              .then(($body) => {
                // Check if content is actually loaded
                const hasContent =
                  $body.text().includes("Posit") ||
                  $body.find("[data-automation]").length > 0;

                if (hasContent) {
                  cy.log("[Extreme] Publisher webview content loaded!");
                  return cy.wrap($publisherIframe.eq(0));
                } else {
                  cy.log(
                    "[Extreme] Publisher iframe found but content not loaded yet",
                  );
                  cy.log(
                    "Body text preview: " + $body.text().substring(0, 100),
                  );

                  if (attempt < maxAttempts) {
                    // eslint-disable-next-line cypress/no-unnecessary-waiting
                    cy.wait(5000); // Wait longer between content checks
                    return attemptFindIframe(attempt + 1, maxAttempts);
                  }
                }
                return cy.wrap($publisherIframe.eq(0));
              });
          }

          // Try to find by class and ready state
          const $readyIframe = $iframes.filter((i, el) => {
            return (
              el.className &&
              el.className.includes("webview") &&
              el.className.includes("ready")
            );
          });

          if ($readyIframe.length > 0) {
            cy.log("[Extreme] Found ready webview iframe!");
            return cy.wrap($readyIframe.eq(0));
          }

          if (attempt < maxAttempts) {
            // eslint-disable-next-line cypress/no-unnecessary-waiting
            cy.wait(3000); // Wait longer between attempts
            cy.reload(); // Try reloading the page
            return attemptFindIframe(attempt + 1, maxAttempts);
          }

          throw new Error("Publisher iframe not found after exhaustive search");
        });
    }

    return attemptFindIframe();
  },
);
