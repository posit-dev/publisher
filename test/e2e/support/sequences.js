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
    cy.getPublisherSidebarIcon().should("be.visible").click();
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
      .find(
        '[aria-label="Create a New Deployment, (or pick one of the existing deployments below), New"]',
      )
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
    cy.getPublisherSidebarIcon().should("be.visible").click();
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
      .find(
        '[aria-label="Create a New Deployment, (or pick one of the existing deployments below), New"]',
      )
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

    cy.get(".quick-input-widget")
      .find(".quick-input-filter input")
      .type(`${title}{enter}`);

    cy.get(".quick-input-widget")
      .contains(".quick-input-list-row", "pcc-deploy-credential")
      .should("be.visible")
      .click();

    // Wait for publisher webview to be ready for file selection
    cy.publisherWebview()
      .find('[data-automation="project-files"]')
      .should("be.visible")
      .should("contain", entrypointFile); // Wait for the file tree to be populated with the entrypoint

    // If filesToSelect is provided and not empty, select additional files
    if (Array.isArray(filesToSelect) && filesToSelect.length > 0) {
      cy.log(
        `Selecting ${filesToSelect.length} additional files for deployment`,
      );

      // Wait for extension to finish its automatic file selection/deselection
      // eslint-disable-next-line cypress/no-unnecessary-waiting
      cy.wait(2000);

      filesToSelect.forEach((fileOrDir) => {
        cy.log(`Processing file selection for: ${fileOrDir}`);

        // Find the checkbox and attempt to select it
        cy.publisherWebview()
          .find('[data-automation="project-files"]')
          .find(`vscode-checkbox[aria-label="${fileOrDir}"]`)
          .should("exist")
          .should("be.visible")
          .then(($checkbox) => {
            const isChecked = $checkbox.attr("aria-checked") === "true";
            const isDisabled =
              $checkbox.attr("disabled") === "true" ||
              $checkbox.attr("aria-disabled") === "true" ||
              $checkbox.hasClass("disabled");

            cy.log(
              `File ${fileOrDir} - checked: ${isChecked}, disabled: ${isDisabled}`,
            );

            if (isDisabled) {
              cy.log(
                `WARNING: ${fileOrDir} is disabled by extension, skipping`,
              );
              return;
            }

            if (!isChecked) {
              cy.log(`Clicking to check: ${fileOrDir}`);
              cy.wrap($checkbox).click({ force: true });

              // Wait and verify the click took effect
              // eslint-disable-next-line cypress/no-unnecessary-waiting
              cy.wait(500);

              // Re-check if it's still enabled and verify selection
              cy.wrap($checkbox).then(($cb) => {
                const stillDisabled =
                  $cb.attr("disabled") === "true" ||
                  $cb.attr("aria-disabled") === "true" ||
                  $cb.hasClass("disabled");
                if (!stillDisabled) {
                  cy.wrap($cb).should("have.attr", "aria-checked", "true");
                } else {
                  cy.log(`${fileOrDir} became disabled after click`);
                }
              });
            } else {
              cy.log(`${fileOrDir} is already checked`);
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
  );
});
