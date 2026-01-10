// Copyright (C) 2025 by Posit Software, PBC.

// tomlCallback interface = func(
// {
//   config: {
//     name: string,
//     path: string,
//     contents: {},
//   },
//   contentRecord: {
//     name: string,
//     path: string,
//     contents: {},
//   }
// })

// Connect Server deployment sequence
// createPCSDeployment
// Purpose: Positive-path helper to create a new Connect Server (PCS) deployment via UI.
// - Navigates Explorer, opens entrypoint, launches Publisher, walks through "Select Deployment" flow.
// - Selects "Create a New Deployment", picks entrypoint, sets title, selects PCS credential.
// - Returns TOML paths and parsed contents so tests can assert config.
// When to use: Any test that needs a full, stable PCS deployment configuration ready to deploy.
Cypress.Commands.add(
  "createPCSDeployment",
  (projectDir, entrypointFile, title, verifyTomlCallback) => {
    // Temporarily ignore uncaught exception due to a vscode worker being cancelled at some point.
    cy.on("uncaught:exception", () => false);

    // Open the entrypoint ahead of time for easier selection later.
    // Always open the Explorer before interacting with the file tree
    cy.get("body").then(($body) => {
      if ($body.find(".explorer-viewlet:visible").length === 0) {
        cy.get("a.codicon-explorer-view-icon").first().click();
        cy.get(".explorer-viewlet").should("be.visible");
      }
    });

    // expand the subdirectory
    if (projectDir !== ".") {
      cy.get(".explorer-viewlet").then(($explorer) => {
        const target = $explorer.find(`[aria-label="${projectDir}"]`);
        if (target.length > 0) {
          cy.wrap(target).click();
        }
      });
    }

    // open the entrypoint file
    cy.get(".explorer-viewlet")
      .find(`[aria-label="${entrypointFile}"]`)
      .should("be.visible")
      .dblclick();

    // confirm that the file got opened in a tab
    cy.get(".tabs-container")
      .find(`[aria-label="${entrypointFile}"]`)
      .should("be.visible");

    // activate the publisher extension
    cy.getPublisherSidebarIcon().click();
    cy.publisherWebview()
      .findByTestId("select-deployment")
      .should("be.visible");
    // Add a log to indicate UI is ready
    cy.log("DEBUG: select-deployment button is visible, UI should be ready");

    // Create a new deployment via the select-deployment button
    cy.publisherWebview()
      .findByTestId("select-deployment")
      .then((dplyPicker) => {
        Cypress.$(dplyPicker).trigger("click");
      });

    // Ux displayed via quick input
    // This has taken longer than 4 seconds on some laptops, so we're increasing
    // the timeout
    cy.get(".quick-input-widget").should("be.visible");

    // confirm we've got the correct sequence
    cy.get(".quick-input-titlebar").should("have.text", "Select Deployment");

    // Create a new deployment
    cy.get(".quick-input-list")
      .find('[aria-label*="Create a New Deployment"]')
      .should("be.visible")
      .click();

    // TODO - Need to specifically select and press enter for creating a new deployment.
    // cy.get(".quickInput_list").get("div").get("div.monaco-list-rows")
    // cy.get(".quickInput_list").find('[aria-label="fastapi - base directory, Missing Credential for http://connect-publisher-e2e:3939 • simple.py, Existing"').click()
    // cy.get(".quickInput_list").find('[aria-label="simple.py, Open Files"]').click()

    // cy.get(".quick-input-widget").type("{enter}")

    // prompt for select entrypoint
    let targetLabel = `${projectDir}/${entrypointFile}, Open Files`;
    if (projectDir === ".") {
      targetLabel = `${entrypointFile}, Open Files`;
    }

    cy.get(".quick-input-widget")
      .find(`[aria-label="${targetLabel}"]`)
      .then(($el) => {
        cy.wrap($el).scrollIntoView();
        cy.wrap($el).click({ force: true });
      });

    // Wait for "enter title" step explicitly (avoid typing into filter step)
    cy.retryWithBackoff(
      () =>
        cy
          .get(".quick-input-widget")
          .find(".quick-input-message")
          .then(($m) => {
            const txt = ($m.text() || "").toLowerCase();
            return /title|name/.test(txt) ? $m : Cypress.$();
          }),
      10,
      700,
    );

    // Robustly set the title value and submit (prevents partial keystrokes in CI)
    cy.get(".quick-input-widget")
      .find(".quick-input-filter input")
      .then(($input) => {
        const el = $input[0];
        el.value = ""; // clear
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.value = title; // set
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });

    // Verify title is set before submitting to advance to credential selection
    cy.get(".quick-input-widget")
      .find(".quick-input-filter input")
      .should("have.value", title);

    cy.get(".quick-input-widget").type("{enter}");

    // Robust credential selection by row content (avoids hidden/virtualized anchors)
    cy.retryWithBackoff(
      () =>
        cy
          .get(".quick-input-widget")
          .contains(".quick-input-list-row", "admin-code-server"),
      8,
      700,
    ).then(($row) => {
      cy.wrap($row).scrollIntoView();
      cy.wrap($row).click({ force: true });
    });

    return cy
      .getPublisherTomlFilePaths(projectDir)
      .then((filePaths) => {
        // Wait for the contentRecord TOML file to exist before loading
        cy.readFile(filePaths.contentRecord.path).then(() => {
          let result = {
            config: {
              name: filePaths.config.name,
              path: filePaths.config.path,
              contents: {},
            },
            contentRecord: {
              name: filePaths.contentRecord.name,
              path: filePaths.contentRecord.path,
              contents: {},
            },
          };
          cy.loadTomlFile(filePaths.config.path)
            .then((config) => {
              result.config.contents = config;
            })
            .loadTomlFile(filePaths.contentRecord.path)
            .then((contentRecord) => {
              result.contentRecord.contents = contentRecord;
            })
            .then(() => {
              return result;
            });
        });
      })
      .then((tomlFiles) => {
        return verifyTomlCallback(tomlFiles);
      });
  },
);

// Connect Cloud deployment sequence
// createPCCDeployment
// Purpose: Positive-path helper to create a new Connect Cloud (PCC) deployment via UI.
// - Same flow as createPCSDeployment but also selects a PCC credential by nickname.
// - Waits for project files tree to load; optionally selects additional files.
// - Returns TOML paths and parsed contents for assertions.
// When to use: PCC deployments that need stable, repeatable UI steps with TOML verification.
Cypress.Commands.add(
  "createPCCDeployment",
  (
    projectDir,
    entrypointFile,
    title,
    verifyTomlCallback,
    filesToSelect = [],
    credentialName = "pcc-deploy-credential",
  ) => {
    cy.on("uncaught:exception", () => false);

    cy.get("body").then(($body) => {
      if ($body.find(".explorer-viewlet:visible").length === 0) {
        cy.get("a.codicon-explorer-view-icon").first().click();
        cy.get(".explorer-viewlet").should("be.visible");
      }
    });

    if (projectDir !== ".") {
      cy.get(".explorer-viewlet").find(`[aria-label="${projectDir}"]`).click();
    }

    cy.get(".explorer-viewlet")
      .find(`[aria-label="${entrypointFile}"]`)
      .should("be.visible")
      .dblclick();

    cy.get(".tabs-container")
      .find(`[aria-label="${entrypointFile}"]`)
      .should("be.visible");

    // activate the publisher extension
    cy.getPublisherSidebarIcon().click();
    cy.publisherWebview()
      .findByTestId("select-deployment")
      .should("be.visible");
    // Add a log to indicate UI is ready
    cy.log("DEBUG: select-deployment button is visible, UI should be ready");

    cy.publisherWebview()
      .findByTestId("select-deployment")
      .then((dplyPicker) => {
        Cypress.$(dplyPicker).trigger("click");
      });

    cy.get(".quick-input-widget").should("be.visible");
    cy.get(".quick-input-titlebar").should("have.text", "Select Deployment");
    cy.get(".quick-input-list")
      .find('[aria-label*="Create a New Deployment"]')
      .should("be.visible")
      .click();

    let targetLabel = `${projectDir}/${entrypointFile}, Open Files`;
    if (projectDir === ".") {
      targetLabel = `${entrypointFile}, Open Files`;
    }

    cy.get(".quick-input-widget")
      .find(`[aria-label="${targetLabel}"]`)
      .then(($el) => {
        cy.wrap($el).scrollIntoView();
        cy.wrap($el).click({ force: true });
      });

    // Wait for "enter title" step explicitly (avoid typing into filter step)
    cy.retryWithBackoff(
      () =>
        cy
          .get(".quick-input-widget")
          .find(".quick-input-message")
          .then(($m) => {
            const txt = ($m.text() || "").toLowerCase();
            return /title|name/.test(txt) ? $m : Cypress.$();
          }),
      10,
      700,
    );

    // Robustly set the title value and submit (prevents partial keystrokes in CI)
    cy.get(".quick-input-widget")
      .find(".quick-input-filter input")
      .then(($input) => {
        const el = $input[0];
        el.value = ""; // clear
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.value = title; // set
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        cy.wrap($input).should("have.value", title).focus();
      });
    cy.get(".quick-input-widget").type("{enter}");

    // Robust credential selection (avoid relying on anchor visibility)
    cy.retryWithBackoff(
      () =>
        cy
          .get(".quick-input-widget")
          .contains(".quick-input-list-row", credentialName),
      6,
      700,
    ).then(($row) => {
      cy.wrap($row).scrollIntoView();
      cy.wrap($row).click({ force: true });
    });

    // Wait for the deployment configuration to load instead of waiting for quick-input to disappear
    cy.publisherWebview()
      .find('[data-automation="project-files"]')
      .should("be.visible")
      .should("contain", entrypointFile); // Wait for the file tree to be populated with the entrypoint

    // If filesToSelect is provided and not empty, select additional files
    if (Array.isArray(filesToSelect) && filesToSelect.length > 0) {
      // Wait a moment for file tree to fully render in CI
      filesToSelect.forEach((fileOrDir) => {
        // Retry with backoff for CI stability
        cy.retryWithBackoff(
          () =>
            cy
              .publisherWebview()
              .find('[data-automation="project-files"]')
              .contains(".tree-item-title", fileOrDir)
              .closest(".tree-item")
              .find('.vscode-checkbox input[type="checkbox"]'),
          10, // more retries
          1000, // longer delays
        )
          .should("exist")
          .should("be.visible")
          .then(($checkbox) => {
            const isChecked = $checkbox.prop("checked");
            if (!isChecked) {
              cy.wrap($checkbox).click({ force: true });
              // eslint-disable-next-line cypress/no-unnecessary-waiting
              cy.wait(500); // Small wait after click
              // Verify the click worked
              cy.wrap($checkbox).should("be.checked");
            }
          });
      });
    }

    return cy
      .getPublisherTomlFilePaths(projectDir)
      .then((filePaths) => {
        // Wait for the contentRecord TOML file to exist before loading
        cy.readFile(filePaths.contentRecord.path).then(() => {
          let result = {
            config: {
              name: filePaths.config.name,
              path: filePaths.config.path,
              contents: {},
            },
            contentRecord: {
              name: filePaths.contentRecord.name,
              path: filePaths.contentRecord.path,
              contents: {},
            },
          };
          cy.loadTomlFile(filePaths.config.path)
            .then((config) => {
              result.config.contents = config;
            })
            .loadTomlFile(filePaths.contentRecord.path)
            .then((contentRecord) => {
              result.contentRecord.contents = contentRecord;
            })
            .then(() => {
              return result;
            });
        });
      })
      .then((tomlFiles) => {
        return verifyTomlCallback(tomlFiles);
      });
  },
);

// deployCurrentlySelected
// Purpose: Click the Deploy button, wait for toasts to clear, and confirm success.
// When to use: Immediately after createPCSDeployment/createPCCDeployment when deployment should succeed.
Cypress.Commands.add("deployCurrentlySelected", () => {
  cy.publisherWebview()
    .findByTestId("deploy-button")
    .should("be.visible")
    .then((dplyBtn) => {
      Cypress.$(dplyBtn).trigger("click");
    });
  // Wait for deploying message to finish
  cy.get(".notifications-toasts", { timeout: 30_000 })
    .should("be.visible")
    .findByText("Deploying your project: Starting to Deploy...")
    .should("not.exist");

  cy.findByText("Deployment was successful", { timeout: 60_000 }).should(
    "be.visible",
  );
});

// Negative workflow sequences
// startDeploymentCreationFlow
// Purpose: Minimal flow to open the "Select Deployment" wizard and choose an entrypoint,
// without completing or committing to a deployment.
// When to use: Negative/cancellation or partial-input scenarios (e.g., pressing ESC).
Cypress.Commands.add("startDeploymentCreationFlow", (entrypointFile) => {
  // Open the Explorer if not already open
  cy.get("body").then(($body) => {
    if ($body.find(".explorer-viewlet:visible").length === 0) {
      cy.get("a.codicon-explorer-view-icon").first().click();
      cy.get(".explorer-viewlet").should("be.visible");
    }
  });

  // Open the entrypoint file
  cy.get(".explorer-viewlet")
    .find(`[aria-label="${entrypointFile}"]`)
    .should("be.visible")
    .dblclick();

  // Confirm the file is opened in a tab
  cy.get(".tabs-container")
    .find(`[aria-label="${entrypointFile}"]`)
    .should("be.visible");

  // Activate the publisher extension
  cy.getPublisherSidebarIcon().click();

  // Wait for the select-deployment button to be visible
  cy.publisherWebview().findByTestId("select-deployment").should("be.visible");
  cy.log("DEBUG: select-deployment button is visible, UI should be ready");

  // Click the select-deployment button
  cy.publisherWebview()
    .findByTestId("select-deployment")
    .then((dplyPicker) => {
      Cypress.$(dplyPicker).trigger("click");
    });

  // Wait for quick input widget
  cy.get(".quick-input-widget").should("be.visible");
  cy.get(".quick-input-titlebar").should("have.text", "Select Deployment");

  // Click to create a new deployment
  cy.get(".quick-input-list")
    .find('[aria-label*="Create a New Deployment"]')
    .should("be.visible")
    .click();

  // Select entrypoint
  cy.get(".quick-input-widget")
    .find(`[aria-label="${entrypointFile}, Open Files"]`)
    .should("be.visible")
    .click();
});

// startCredentialCreationFlow
// Purpose: Open the Credentials section, click "New Credential", and select a platform.
// - Ensures the credentials section is expanded (idempotent).
// - Accepts "server" or "Posit Connect Cloud" for platform.
// When to use: To standardize starting credential creation via UI in tests (PCS or PCC).
Cypress.Commands.add("startCredentialCreationFlow", (platform = "server") => {
  // Check if we're already in the publisher webview
  cy.get("body").then(($body) => {
    const iframes = $body.find("iframe.webview.ready");
    const publisherIframe = iframes.filter(
      (i, el) => el.src && el.src.includes("posit.publisher"),
    );

    if (publisherIframe.length === 0) {
      // Not in publisher webview yet, need to click the icon
      cy.log("Not in publisher webview, clicking publisher icon");
      cy.getPublisherSidebarIcon().click();
    } else {
      cy.log("Already in publisher webview, skipping icon click");
    }
  });

  cy.waitForPublisherIframe();
  cy.debugIframes();

  // Ensure the Credentials section is expanded (visibility-based check with retry)
  const ensureCredentialsSectionExpanded = (attempt = 0) => {
    if (attempt > 3) {
      cy.log("Max attempts reached ensuring credentials section expansion");
      return;
    }
    cy.publisherWebview()
      .findByTestId("publisher-credentials-section")
      .then(($section) => {
        const $sec = Cypress.$($section);
        const isVisibleEmpty =
          $sec
            .find(':contains("No credentials have been added yet.")')
            .filter(":visible").length > 0;
        const hasVisibleBody =
          $sec.find(".pane-body:visible").length > 0 ||
          $sec.find(".tree:visible").length > 0;

        const expanded = isVisibleEmpty || hasVisibleBody;

        if (!expanded) {
          cy.log(
            `Credentials section appears collapsed, expanding (attempt ${
              attempt + 1
            })`,
          );
          $sec.find(".title").trigger("click");
          // eslint-disable-next-line cypress/no-unnecessary-waiting
          cy.wait(200).then(() =>
            ensureCredentialsSectionExpanded(attempt + 1),
          );
        } else {
          cy.log("Credentials section expanded");
        }
      });
  };

  ensureCredentialsSectionExpanded();

  // After ensuring expansion, proceed
  cy.publisherWebview()
    .findByText("No credentials have been added yet.")
    .should("be.visible");

  cy.clickSectionAction("New Credential");
  cy.get(".quick-input-widget").should("be.visible");

  cy.get(".quick-input-titlebar").should(
    "have.text",
    "Create a New Credential",
  );

  // Select platform - use the exact same pattern as working tests
  if (platform === "Posit Connect Cloud") {
    cy.get(".quick-input-list-row")
      .contains("Posit Connect Cloud")
      .should("be.visible")
      .click();
  } else {
    cy.get(".quick-input-list-row").contains(platform).click();
  }
});

// startPCCOAuthFlow
// Purpose: Specialized flow to start PCC OAuth UI and stub window.open for the device flow.
// - Calls startCredentialCreationFlow("Posit Connect Cloud").
// - Waits for the modal and stubs window.open before the "Open" click.
// When to use: Tests that exercise real OAuth device flow via the Playwright task.
Cypress.Commands.add("startPCCOAuthFlow", () => {
  cy.startCredentialCreationFlow("Posit Connect Cloud");

  // Wait for OAuth dialog
  cy.get(".monaco-dialog-box")
    .should("be.visible")
    .should("have.attr", "aria-modal", "true");

  // Handle the OAuth popup window BEFORE clicking Open
  cy.window().then((win) => {
    // Override window.open to simulate the popup behavior
    cy.stub(win, "open")
      .callsFake((url) => {
        // Store the OAuth URL for later use
        win.oauthUrl = url;
        console.log("OAuth URL captured:", url);

        // Create a mock window object that will simulate closing after OAuth
        const mockWindow = {
          closed: false,
          close: function () {
            this.closed = true;
            // Notify the extension that the popup has closed (OAuth completed)
            setTimeout(() => {
              win.dispatchEvent(new Event("focus"));
              console.log(
                "OAuth popup closed - extension should check for completion",
              );
            }, 100);
          },
          focus: () => {},
          postMessage: () => {},
        };

        // Store the mock window for later use
        win.mockOAuthWindow = mockWindow;

        return mockWindow;
      })
      .as("windowOpen");
  });
});

// expectInitialPublisherState
// Purpose: Quick assertion that the Publisher webview loaded and is interactive
// by checking "select-deployment" is visible.
// When to use: At the start of tests to reduce flakiness before interacting with UI.
Cypress.Commands.add("expectInitialPublisherState", () => {
  cy.publisherWebview().findByTestId("select-deployment").should("be.visible");
});
// by checking "select-deployment" is visible.
// When to use: At the start of tests to reduce flakiness before interacting with UI.
Cypress.Commands.add("expectInitialPublisherState", () => {
  cy.publisherWebview().findByTestId("select-deployment").should("be.visible");
});
