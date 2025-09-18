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
Cypress.Commands.add(
  "createPCSDeployment",
  (
    projectDir, // string
    entrypointFile, // string
    title, // string
    verifyTomlCallback, // func({config: { filename: string, contents: {},}, contentRecord: { filename: string, contents: {}})
  ) => {
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
      cy.get(".explorer-viewlet").find(`[aria-label="${projectDir}"]`).click();
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
      .should("be.visible")
      .click();

    cy.get(".quick-input-widget")
      .find(".quick-input-filter input")
      .type(`${title}{enter}`);

    cy.get(".quick-input-widget")
      .find(
        '[aria-label="admin-code-server, http://connect-publisher-e2e:3939"]',
      )
      .should("be.visible")
      .click();

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
Cypress.Commands.add(
  "createPCCDeployment",
  (
    projectDir, // string
    entrypointFile, // string
    title, // string
    verifyTomlCallback, // func
    filesToSelect = [], // array of file/dir names to select in the file selection pane (optional)
    credentialName = "pcc-deploy-credential", // string - name of the credential to select (optional)
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
      .should("be.visible")
      .click();

    cy.get(".quick-input-widget").find(".quick-input-filter input").type(title);

    cy.get(".quick-input-widget")
      .find(".quick-input-filter input")
      .should("have.value", title)
      .type("{enter}");

    cy.get(".quick-input-widget")
      .find(".quick-input-list-row")
      .contains(credentialName)
      .should("be.visible")
      .click();

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

Cypress.Commands.add("deployCurrentlySelected", () => {
  cy.publisherWebview()
    .findByTestId("deploy-button")
    .should("be.visible")
    .then((dplyBtn) => {
      Cypress.$(dplyBtn).trigger("click");
    });
  // Wait for deploying message to finish
  cy.get(".notifications-toasts", { timeout: 30000 })
    .should("be.visible")
    .findByText("Deploying your project: Starting to Deploy...")
    .should("not.exist");

  cy.findByText("Deployment was successful", { timeout: 60000 }).should(
    "be.visible",
    { message: "Deployment didn't succeed within 60 seconds." },
  );
});

// Negative workflow sequences
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

  // Check if credentials section is already showing the empty message before toggling
  cy.publisherWebview().then(($webview) => {
    const hasEmptyMessage =
      Cypress.$($webview).find(
        ':contains("No credentials have been added yet.")',
      ).length > 0;

    if (!hasEmptyMessage) {
      cy.log("Credentials section appears collapsed, expanding it");
      cy.toggleCredentialsSection();
    } else {
      cy.log(
        "Credentials section already expanded with empty message, skipping toggle",
      );
    }
  });

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

Cypress.Commands.add("expectInitialPublisherState", () => {
  cy.publisherWebview().findByTestId("select-deployment").should("be.visible");
});
