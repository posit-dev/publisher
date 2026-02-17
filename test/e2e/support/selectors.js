// Commands to serve as utility selectors to tame Cypress + iframes limitations.
// Guidance:
// - publisherWebview: primary entry to the extension's inner DOM (waits and validates).
// - publisherWebviewExtreme: last-resort iframe locator (slower).
// - getPublisherSidebarIcon: finds the activity bar icon with stability checks.
// - findInPublisherWebview: query inside the webview content (optionally cached).
// - toggle/refresh section helpers: interact with collapsing panels reliably.

// publisherWebview
// Purpose: Resolve the Publisher extension's nested iframe and return its inner body.
// - Uses waitUntil for cleaner retry logic, reloads once if needed.
// When to use: Before any .findByTestId() inside the extension.
Cypress.Commands.add("publisherWebview", () => {
  let hasReloaded = false;

  // Helper to find the publisher iframe and return its body
  const findPublisherIframeBody = () => {
    return cy.get("body").then(($body) => {
      const $iframes = $body.find("iframe.webview.ready");
      if (Cypress.env("DEBUG_CYPRESS") === "true") {
        cy.task("print", `Found ${$iframes.length} webview.ready iframes`);
      }

      // Filter to find the publisher iframe using JavaScript (not CSS selector)
      // because the src URL contains encoded characters
      const $target = $iframes.filter((i, el) =>
        (el.src || "").includes("extensionId=posit.publisher"),
      );

      if ($target.length > 0) {
        const outerBody = $target[0].contentDocument?.body;
        if (outerBody) {
          const bodyText = outerBody.innerText || "";
          const hasAutomationElements =
            outerBody.querySelector("[data-automation]") !== null;

          if (bodyText.includes("Posit") || hasAutomationElements) {
            cy.log("Publisher iframe content verified");
            return outerBody;
          }
        }
      }
      return null;
    });
  };

  // Wait for publisher iframe using cypress-wait-until
  return cy
    .waitUntil(
      () =>
        findPublisherIframeBody().then((body) => {
          if (body) return body;

          // If not found and haven't reloaded yet, log it
          if (!hasReloaded) {
            cy.log(
              "Publisher iframe not found, will reload page on next attempt...",
            );
          }
          return false;
        }),
      {
        timeout: 60000,
        interval: 2000,
        errorMsg:
          "Publisher iframe not found. UI may not have loaded correctly.",
      },
    )
    .then((outerBody) => {
      // If still not found after timeout, try reload once
      if (!outerBody && !hasReloaded) {
        hasReloaded = true;
        cy.log("Reloading page to find publisher iframe...");
        cy.reload();
        return cy.waitUntil(() => findPublisherIframeBody(), {
          timeout: 20000,
          interval: 2000,
          errorMsg: "Publisher iframe not found even after page reload.",
        });
      }
      return outerBody;
    })
    .then((outerBody) => {
      // Now find the inner active-frame iframe
      return cy
        .wrap(outerBody)
        .find("iframe#active-frame", { timeout: 30000 })
        .its("0.contentDocument.body")
        .should("not.be.empty");
    })
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

// publisherWebviewExtreme
// Purpose: Extreme/last-resort iframe finder when publisherWebview cannot resolve.
// - Uses broader heuristics and logs details for debugging.
// When to use: Rare; typically only in debugging or CI recovery scenarios.
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

// getPublisherSidebarIcon
// Purpose: Locate the "Posit Publisher" activity bar icon with multiple selectors
// and ensure the UI is stable before clicking.
// When to use: Before opening the Publisher webview from VS Code UI.
Cypress.Commands.add("getPublisherSidebarIcon", () => {
  const selectors = [
    'button[aria-label*="Posit Publisher"]',
    'button[title*="Posit Publisher"]',
    'button[aria-label*="Publisher"]',
    'button[title*="Publisher"]',
    ".codicon-posit-publisher-publish",
  ];

  const loadingIndicators = [
    "starting posit publisher",
    "python extension loading",
    "please wait",
    "activating extension",
  ];

  // Wait for extension loading indicators to clear using cypress-wait-until
  cy.waitUntil(
    () =>
      cy.get("body").then(($body) => {
        const bodyText = $body.text().toLowerCase();
        const isLoading = loadingIndicators.some((indicator) =>
          bodyText.includes(indicator),
        );
        if (isLoading) {
          cy.log("Extension still loading, waiting...");
        }
        return !isLoading;
      }),
    {
      timeout: 45000,
      interval: 1500,
      errorMsg: "Extension loading indicators did not clear in time",
    },
  );

  // Build a combined selector to find the icon with any of the patterns
  const combinedSelector = selectors.join(", ");

  // Use Cypress's built-in retry to find and verify the icon is visible
  return cy
    .get(combinedSelector, { timeout: 30000 })
    .first()
    .should("be.visible");
});

// toggleCredentialsSection / refreshCredentials / toggleHelpSection
// Purpose: Interact with collapsible sections reliably via jQuery events.
// When to use: Manipulate sections within the webview where Cypress click() can be flaky.
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

Cypress.Commands.add("refreshCredentials", () => {
  // Robustly locate the credentials section inside the webview before interacting
  cy.retryWithBackoff(
    () =>
      cy.publisherWebview().then((body) => {
        const $body = Cypress.$(body);
        return $body.find('[data-automation="publisher-credentials-section"]');
      }),
    8,
    500,
  ).then(($section) => {
    // Mouseover section to reveal the refresh action and click it
    Cypress.$($section).trigger("mouseover");
    const $btn = Cypress.$($section).find(
      'a[aria-label="Refresh Credentials"]',
    );
    // Force click via vanilla JS for reliability
    if ($btn.length && $btn[0]) {
      $btn[0].click();
    } else {
      throw new Error("Refresh Credentials button not found");
    }
  });

  // Wait for credential refresh API call to complete
  cy.waitForNetworkIdle(500);
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

// clickSectionAction
// Purpose: Click header action buttons (e.g., "New Credential", "Refresh") that need vanilla click().
// When to use: Trigger actions in section headers where Cypress/jQuery clicks are unreliable.
Cypress.Commands.add("clickSectionAction", (actionLabel) => {
  // Due to Cypress + iframes limited support,
  // clicking section actions needs to be done with jQuery elements
  // Cypress chained methods will fail in this case.

  // In addition, there is something with the actions where the
  // only way to trigger clicks on them is to use vanilla JS click method.
  // Cypress nor jQuery methods succeed in this space.
  cy.publisherWebview()
    .findByTestId("publisher-credentials-section")
    .then((section) => {
      Cypress.$(section).find(".pane-header").trigger("focus");
      Cypress.$(section).find(`[aria-label="${actionLabel}"]`)[0].click();
    });
});

// NOTE: findInPublisherWebview is defined in commands.js with caching logic.
// Do not duplicate here.

// findPublisherIframeExtreme
// Purpose: Broad, multi-attempt scan for any iframe that looks like the Publisher webview.
// When to use: Troubleshooting only (invoked internally as a last resort).
Cypress.Commands.add(
  "findPublisherIframeExtreme",
  { prevSubject: false },
  () => {
    function attemptFindIframe(attempt = 1, maxAttempts = 10) {
      cy.log(`[Extreme] Iframe find attempt ${attempt}/${maxAttempts}`);

      return cy.get("iframe", { log: false }).then(($iframes) => {
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
            .its("0.contentDocument.body")
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
                cy.log("Body text preview: " + $body.text().substring(0, 100));

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
