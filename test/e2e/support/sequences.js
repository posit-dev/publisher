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

Cypress.Commands.add(
  "createDeployment",
  (
    projectDir, // string
    entrypointFile, // string
    title, // string
    verifyTomlCallback, // func({config: { filename: string, contents: {},}, contentRecord: { filename: string, contents: {}})
  ) => {
    // Temporarily ignore uncaught exception due to a vscode worker being cancelled at some point.
    cy.on("uncaught:exception", () => false);

    // Open the entrypoint ahead of time for easier selection later.
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

    // Create a new deployment via the select-deployment button
    cy.publisherWebview()
      .findByTestId("select-deployment")
      .then((dplyPicker) => {
        Cypress.$(dplyPicker).trigger("click");
      });

    // Ux displayed via quick input
    // This has taken longer than 4 seconds on some laptops, so we're increasting
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

  // Wait for deploying  message to finish
  cy.get(".notifications-toasts")
    .should("be.visible")
    .findByText("Deploying your project: Starting to Deploy...")
    .should("not.exist");

  cy.findByText("Deployment was successful", { timeout: 60000 }).should(
    "be.visible",
  );
});
