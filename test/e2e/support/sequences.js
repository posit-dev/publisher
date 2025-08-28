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
    cy.get("a.codicon-explorer-view-icon").first().click();
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
    cy.getPublisherSidebarIcon()
      .should("be.visible", { timeout: 10000 })
      .click();

    // Small wait to allow the UI to settle in CI before proceeding
    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(1000);

    // Create a new deployment via the select-deployment button
    cy.publisherWebview()
      .findByTestId("select-deployment")
      .then((dplyPicker) => {
        Cypress.$(dplyPicker).trigger("click");
      });

    // Ux displayed via quick input
    // This has taken longer than 4 seconds on some laptops, so we're increasing
    // the timeout
    cy.get(".quick-input-widget", { timeout: 10000 }).should("be.visible");

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
        cy.readFile(filePaths.contentRecord.path, { timeout: 10000 });
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
        cy.get(".explorer-viewlet", { timeout: 10000 }).should("be.visible");
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

    cy.getPublisherSidebarIcon()
      .should("be.visible", { timeout: 10000 })
      .click();

    cy.publisherWebview()
      .findByTestId("select-deployment")
      .then((dplyPicker) => {
        Cypress.$(dplyPicker).trigger("click");
      });

    cy.get(".quick-input-widget", { timeout: 10000 }).should("be.visible");
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

    // If filesToSelect is provided and not empty, select additional files
    if (Array.isArray(filesToSelect) && filesToSelect.length > 0) {
      filesToSelect.forEach((fileOrDir) => {
        cy.publisherWebview()
          .find('[data-automation="project-files"]')
          .find(`vscode-checkbox[aria-label="${fileOrDir}"]`)
          .should("exist")
          .then(($checkbox) => {
            if ($checkbox.attr("aria-checked") !== "true") {
              cy.wrap($checkbox).click({ force: true });
            }
          })
          .should("have.attr", "aria-checked", "true");
      });
    }

    return cy
      .getPublisherTomlFilePaths(projectDir)
      .then((filePaths) => {
        // Wait for the contentRecord TOML file to exist before loading
        cy.readFile(filePaths.contentRecord.path, { timeout: 10000 });
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
    .findByText("Deploying your project: Starting to Deploy...", {
      timeout: 10000,
    })
    .should("not.exist");

  cy.findByText("Deployment was successful", { timeout: 60000 }).should(
    "be.visible",
  );
});
