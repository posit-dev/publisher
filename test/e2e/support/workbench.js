// Copyright (C) 2025 by Posit Software, PBC.

/**
 * Support file containing Workbench-specific Cypress commands
 */

/**
 * Logs into Workbench using default credentials and waits for the UI to load
 * Uses the default Workbench username/password as documented here: https://hub.docker.com/r/rstudio/rstudio-workbench
 * @param {string} username - The username to login with (defaults to "rstudio")
 * @param {string} password - The password to login with (defaults to "rstudio")
 */
Cypress.Commands.add(
  "visitAndLoginToWorkbench",
  (username = "rstudio", password = "rstudio") => {
    cy.log(`Logging into Workbench as ${username}`);

    cy.visit("/");

    // Enter credentials and submit the form
    cy.get("#username").type(username);
    cy.get("#password").type(password);
    cy.get("#signinbutton").click();

    // Wait for the main workbench UI to load
    cy.get("button").contains("New Session").should("be.visible");

    cy.log("Successfully logged into Workbench");
  },
);

/**
 * Clean up Workbench data files and directories to ensure a fresh state
 * This does not restart the Workbench container, so any existing sessions would still be visible in the Workbench UI
 * but all deployment data is removed. This is necessary to ensure a clean state between tests since we bind mount the
 * workspace directory into the container and data would otherwise persist between tests.
 * @param {string} projectDir - The project directory (optional). If provided, will also clean up project-specific data
 */
Cypress.Commands.add("cleanupWorkbenchData", (projectDir) => {
  cy.log("Cleaning up Workbench data");

  // Define paths to clean up
  const cleanupPaths = [
    "content-workspace/.cache",
    "content-workspace/.duckdb",
    "content-workspace/.ipython",
    "content-workspace/.local",
    "content-workspace/.positron-server",
    "content-workspace/.connect-credentials",
  ];

  // Only add project-specific path if a projectDir was provided
  if (projectDir) {
    cleanupPaths.push(`content-workspace/${projectDir}/.posit`);
  }

  cy.exec(`rm -rf ${cleanupPaths.join(" ")}`, {
    failOnNonZeroExit: false,
  }).then((result) => {
    cy.log(`Cleanup directories result: exit code ${result.code}`);
    if (result.stderr) cy.log(`Cleanup stderr: ${result.stderr}`);
  });

  // Remove workbench e2e projects
  cy.exec(
    `for dir in content-workspace/${Cypress.env("WORKBENCH_PROJECT_PREFIX")}*; do rm -rf "$dir" 2>/dev/null || true; done`,
    {
      failOnNonZeroExit: false,
    },
  ).then((result) => {
    cy.log(`Cleanup projects result: code ${result.code}`);
    if (result.stderr) cy.log(`Cleanup projects stderr: ${result.stderr}`);
  });
});

/**
 * Cleans up and restarts the Workbench container to ensure a fresh state
 * This function stops the current container, removes any test data, and starts a fresh container
 * with clean state. It handles container lifecycle operations using the justfile commands
 *
 * @param {string} projectDir - Optional project directory to clean up specific project data
 */
Cypress.Commands.add("cleanupAndRestartWorkbench", (projectDir) => {
  // Stop and remove the container
  cy.log("Stopping and removing Workbench container");
  cy.exec(`just remove-workbench release`, {
    failOnNonZeroExit: false,
    timeout: 10_000,
  }).then((result) => {
    cy.log(`Remove workbench result: exit code ${result.code}`);
    cy.log(
      `Remove workbench stdout: ${result.stdout.substring(0, 1000)}${result.stdout.length > 1000 ? "..." : ""}`,
    );
    if (result.stderr) {
      cy.log(`Remove workbench stderr: ${result.stderr}`);
    }

    // For container removal, we don't need to fail the test if it returns non-zero
    // since the container might not exist yet, just log the result
    if (result.code !== 0) {
      cy.log(
        `Warning: remove-workbench command returned non-zero exit code: ${result.code}`,
      );
    }
  });

  // Clean up the workspace data
  cy.cleanupWorkbenchData(projectDir);

  // Start a fresh container, the justfile command includes a health check wait
  cy.log("Starting fresh Workbench container");

  // Add global error logging for better debugging in CI
  let startTime = Date.now();
  cy.on("fail", (err) => {
    if (err.message && err.message.includes("start-workbench")) {
      const duration = (Date.now() - startTime) / 1000;
      cy.log(
        `ERROR: Container start failed after ${duration}s with: ${err.message}`,
      );
      cy.task(
        "log",
        `Container start failed after ${duration}s: ${err.message}`,
      );

      // Check the container status to get additional information
      cy.exec("docker ps -a | grep workbench", {
        failOnNonZeroExit: false,
      }).then((statusResult) => {
        cy.log(
          `Container status: ${statusResult.stdout || "No container found"}`,
        );
      });

      // Get container logs if possible
      cy.exec("docker logs publisher-e2e.workbench-release 2>&1 | tail -n 50", {
        failOnNonZeroExit: false,
      }).then((logsResult) => {
        cy.log(
          `Container logs (last 50 lines): ${logsResult.stdout || "No logs available"}`,
        );
      });
    }
    throw err; // Re-throw the error to continue normal Cypress error handling
  });

  cy.exec(`just start-workbench release`, {
    failOnNonZeroExit: false,
    timeout: 100_000, // Increased to give buffer beyond the justfile timeout (90s)
  }).then((result) => {
    // Cancel the error handler
    cy.removeAllListeners("fail");

    // Always log output regardless of success/failure
    cy.log(
      `Start workbench result: exit code ${result.code} (took ${(Date.now() - startTime) / 1000}s)`,
    );
    cy.log(
      `Start workbench stdout: ${result.stdout.substring(0, 1000)}${result.stdout.length > 1000 ? "..." : ""}`,
    );
    if (result.stderr) {
      cy.log(`Start workbench stderr: ${result.stderr}`);
    }

    // Fail the test with a more descriptive message if the command failed
    if (result.code !== 0) {
      throw new Error(
        `Failed to start Workbench container. Exit code: ${result.code}. See logs above for details.`,
      );
    }
  });

  // Install the Publisher extension
  cy.log("Installing Publisher extension in Workbench");
  cy.exec(`just install-workbench-extension release`, {
    failOnNonZeroExit: false,
    timeout: 30_000,
  }).then((result) => {
    cy.log(`Install extension result: exit code ${result.code}`);
    cy.log(
      `Install extension stdout: ${result.stdout.substring(0, 1000)}${result.stdout.length > 1000 ? "..." : ""}`,
    );
    if (result.stderr) {
      cy.log(`Install extension stderr: ${result.stderr}`);
    }

    // Fail the test with a more descriptive message if the command failed
    if (result.code !== 0) {
      throw new Error(
        `Failed to install Workbench extension. Exit code: ${result.code}. See logs above for details.`,
      );
    }
  });

  cy.log(
    "Workbench container started and ready with clean data and Publisher extension installed",
  );
});

/**
 * Starts a Positron session in Workbench and waits for it to be ready
 * This includes waiting for all necessary UI elements and session initialization
 */
Cypress.Commands.add("startWorkbenchPositronSession", () => {
  cy.log("Starting Workbench Positron session");

  // Start a Positron session
  cy.get("#newSessionBtn").click();
  cy.get("button").contains("Positron").click();
  cy.get("button").contains("Start Session").click();

  // Wait for the Workbench UI to load
  cy.waitForWorkbenchToLoad();

  // Wait for the session to start, a new session usually takes ~30s
  cy.contains(/Welcome.*Positron/i).should("be.visible");

  // Do not wait for additional extensions or interpreter at this point, we will do that after opening a project

  cy.log("Positron session started and ready");
});

/**
 * Waits for the Workbench UI to load by checking for the presence of the workbench indicator
 *
 * @example
 *    cy.waitForWorkbenchToLoad()
 */
Cypress.Commands.add("waitForWorkbenchToLoad", () => {
  cy.log("Waiting for Workbench UI to load");
  // Workbench indicator in bottom status bar, uses a longer timeout to accommodate slow loads
  cy.get("[id='rstudio.rstudio-workbench']", { timeout: 60_000 }).should(
    "be.visible",
  );
  cy.log("Workbench UI loaded");
});

/**
 * Checks if an interpreter is ready without attempting to start one
 * @returns {Cypress.Chainable<boolean>} - Returns a chainable boolean indicating if interpreter is ready
 */
Cypress.Commands.add("isInterpreterReady", () => {
  cy.log("Checking if interpreter is ready");

  return cy.document({ log: false }).then(($document) => {
    const loadedSelector = $document.querySelector(
      '[aria-label="Select Interpreter Session"]',
    );
    return loadedSelector !== null;
  });
});

/**
 * Waits for the interpreter to be ready, with a maximum timeout of 30 seconds
 * Uses isInterpreterReady internally and will fail the test if timeout is reached
 * @returns {Cypress.Chainable<boolean>} - Returns a chainable boolean that will be true when interpreter is ready
 */
Cypress.Commands.add("waitForInterpreterReady", () => {
  cy.log("Waiting for interpreter to be ready");

  return cy.waitUntil(() => cy.isInterpreterReady().then((ready) => ready), {
    timeout: 30_000,
    interval: 1_000,
    errorMsg: "Interpreter was not ready within 30 seconds",
  });
});

/**
 * Creates a new Positron deployment in Workbench
 *
 * Note: This function is derived from the VS Code deployment flow in the main Publisher extension tests,
 * but has been specifically adapted for the Workbench UI environment which has different navigation
 * patterns, element selectors, and timing considerations. In particular, the Workbench integration
 * requires additional steps to handle the Positron editor context and different menu structures.
 *
 * @param {string} projectDir - The directory containing the project to deploy
 * @param {string} entrypointFile - The primary file to use as the entrypoint (e.g., "index.html")
 * @param {string} title - The title to give to the deployment
 * @param {Function} verifyTomlCallback - Callback function to verify TOML configuration
 *        The callback receives an object with structure: {
 *          config: { name: string, path: string, contents: Object },
 *          contentRecord: { name: string, path: string, contents: Object }
 *        }
 * @param {string} [platformType="Connect"] - The type of platform to deploy to ("Connect" for Posit Connect or "Cloud" for Posit Connect Cloud)
 * @returns {Cypress.Chainable} - Chain that can be extended with additional deployment actions
 */
Cypress.Commands.add(
  // TODO rename this to createPWBDeployment
  "createPositronDeployment",
  (
    projectDir,
    entrypointFile,
    title,
    verifyTomlCallback,
    platformType = "Connect",
  ) => {
    cy.log("Creating Positron deployment in Workbench");

    // Temporarily ignore uncaught exception due to a vscode worker being cancelled at some point
    cy.on("uncaught:exception", () => false);

    // Open the entrypoint ahead of time for easier selection later
    // Uses the Workbench-specific open folder flow
    // Note this deviates from the VS Code logic and does not currently handle projectDir = "."
    cy.get("button").contains("Open Folder...").click();
    cy.get(".quick-input-widget").within(() => {
      cy.get(".quick-input-box input").should("be.visible");
      cy.get(`.monaco-list-row[aria-label="${projectDir}"]`).click();
      // Need to pace the test slightly to allow the selection to register or clicking "OK" sometimes does not work
      cy.get(`.monaco-list-row[aria-label="${projectDir}"]`).should(
        "not.exist",
      );
      cy.get(".quick-input-header a[role='button']").contains("OK").click();
    });

    // open the entrypoint file
    cy.get(".explorer-viewlet")
      .find(`[aria-label="${entrypointFile}"]`)
      .should("be.visible")
      .dblclick();

    // confirm that the file got opened in a tab
    cy.get(".tabs-container")
      .find(`[aria-label="${entrypointFile}"]`)
      .should("be.visible");

    cy.waitForWorkbenchToLoad();
    // Workbench should automatically spin up an appropriate interpreter based on the project that has been opened
    if (projectDir !== "static") {
      cy.waitForInterpreterReady();
    }

    // Activate the publisher extension
    // In Workbench the viewport size causes Publisher to be in the "..." menu
    cy.get(
      '[id="workbench.parts.activitybar"] .action-item[role="button"][aria-label="Additional Views"]',
      {
        timeout: 30_000,
      },
    ).click();
    // Wait for popup menu that contains Publisher to appear
    cy.get('.monaco-menu .actions-container[role="menu"]')
      .should("be.visible")
      .within(() => {
        // Finally, double-click the Posit Publisher menu item, single click often fails to open it
        // TODO sometimes Publisher does not open, unclear why. Likely needs some additional waiting on IDE readiness
        cy.findByLabelText("Posit Publisher").dblclick();
      });

    // Small wait to allow the UI to settle in CI before proceeding
    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(1_000);

    // Create a new deployment via the select-deployment button
    cy.publisherWebview()
      .findByTestId("select-deployment")
      .then((dplyPicker) => {
        Cypress.$(dplyPicker).trigger("click");
      });

    // Ux displayed via quick input
    // This has taken longer than 4 seconds on some laptops, so we're increasing the timeout
    cy.get(".quick-input-widget", { timeout: 10_000 }).should("be.visible");

    // Confirm we've got the correct sequence
    cy.get(".quick-input-titlebar").should("have.text", "Select Deployment");

    // Create a new deployment
    cy.get(".quick-input-list").contains("Create a New Deployment").click();

    // Prompt for select entrypoint
    // Note this deviates from the VS Code logic and does not currently handle projectDir = "."
    const targetLabel = `${entrypointFile}, Open Files`;
    cy.get(".quick-input-widget")
      .should("contain.text", "Select a file as your entrypoint")
      .find(`[aria-label="${targetLabel}"]`)
      .click();

    cy.get(".quick-input-widget")
      .should("contain.text", "Create a New Deployment")
      .find("input")
      .type(`${title}` + "{enter}");

    cy.get(".quick-input-widget")
      .should("be.visible")
      .within(() => {
        cy.get('[role="listbox"]')
          .should("have.attr", "aria-label")
          .and("include", "Please select the platform");

        // Choose the appropriate platform based on the platformType parameter
        if (platformType.toLowerCase().includes("cloud")) {
          cy.get(
            '[aria-label="Posit Connect Cloud, Deploy data applications and documents online. Free plan available."]',
          ).click();
        } else {
          cy.get(
            '[aria-label="Posit Connect, Deploy data applications, documents, APIs, and more to your server."]',
          ).click();
        }
      });

    cy.get(".quick-input-widget")
      .should("contain.text", "Please provide the Posit Connect server's URL")
      .find("input")
      .type("http://connect-publisher-e2e:3939" + "{enter}");

    // Wait for the authentication method selection dialog
    cy.get(".quick-input-widget")
      .should("be.visible")
      .within(() => {
        // Verify we're on the authentication method selection screen using the input's aria-label
        cy.get(
          'input[aria-label="Select authentication method - Create a New Deployment"]',
        ).should("be.visible");

        // Click on the "API Key" option
        cy.get('[aria-label="API Key, Manually enter an API key"]')
          .should("be.visible")
          .click();
      });

    cy.get(".quick-input-widget")
      .should("contain.text", "The API key")
      .find("input")
      .type(Cypress.env("BOOTSTRAP_ADMIN_API_KEY") + "{enter}");

    cy.get(".quick-input-widget")
      .should("contain.text", "Enter a unique nickname for this server")
      .find("input")
      .type("Posit Connect" + "{enter}");

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
