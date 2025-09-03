// Copyright (C) 2025 by Posit Software, PBC.

describe("Workbench > Positron", { baseUrl: "http://localhost:8787" }, () => {
  // Each test must set this var to enable project-specific cleanup
  let projectDir;

  beforeEach(() => {
    cy.cleanupAndRestartWorkbench();

    cy.resetConnect();
    cy.setAdminCredentials();
    cy.visit("/");

    cy.loginToWorkbench();
  });

  afterEach(() => {
    cy.cleanupWorkbenchData(projectDir);
  });

  it("Static Content Deployment", () => {
    projectDir = "static";

    cy.startWorkbenchPositronPythonProject(projectDir);

    // Publish the content
    cy.createPositronDeployment(
      projectDir,
      "index.html",
      "static",
      (tomlFiles) => {
        const config = tomlFiles.config.contents;
        expect(config.title).to.equal(projectDir);
        expect(config.type).to.equal("html");
        expect(config.entrypoint).to.equal("index.html");
        expect(config.files[0]).to.equal("/index.html");
        expect(config.files[1]).to.equal(
          `/.posit/publish/${tomlFiles.config.name}`,
        );
        expect(config.files[2]).to.equal(
          `/.posit/publish/deployments/${tomlFiles.contentRecord.name}`,
        );
      },
    ).deployCurrentlySelected();
  });
});

/**
 * Logs into Workbench using default credentials and waits for the UI to load.
 * @param {string} username - The username to login with (defaults to "rstudio")
 * @param {string} password - The password to login with (defaults to "rstudio")
 */
Cypress.Commands.add(
  "loginToWorkbench",
  (username = "rstudio", password = "rstudio") => {
    cy.log(`Logging into Workbench as ${username}`);

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
 * This does not restart the Workbench container, so any existing sessions will still be visible in the Workbench UI but
 * all deployment data is removed
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

  // Remove test-* directories
  cy.exec(
    'for dir in content-workspace/test-*; do rm -rf "$dir" 2>/dev/null || true; done',
    {
      failOnNonZeroExit: false,
    },
  ).then((result) => {
    cy.log(`Bash loop cleanup result: code ${result.code}`);
    if (result.stderr) cy.log(`Cleanup stderr: ${result.stderr}`);
  });
});

Cypress.Commands.add("cleanupAndRestartWorkbench", (projectDir) => {
  // Stop and remove the container
  cy.log("Stopping and removing Workbench container");
  cy.exec(`just remove-workbench release`, {
    failOnNonZeroExit: false,
    timeout: 10_000,
  }).then((result) => {
    cy.log(`Remove workbench result: exit code ${result.code}`);
    if (result.stdout)
      cy.log(
        `Remove workbench stdout: ${result.stdout.substring(0, 500)}${result.stdout.length > 500 ? "..." : ""}`,
      );
    if (result.stderr)
      cy.log(
        `Remove workbench stderr: ${result.stderr.substring(0, 500)}${result.stderr.length > 500 ? "..." : ""}`,
      );
  });

  // Clean up the workspace data
  cy.cleanupWorkbenchData(projectDir);

  // Start a fresh container, the justfile command includes a health check wait
  cy.log("Starting fresh Workbench container");
  cy.exec(`just start-workbench release`, {
    failOnNonZeroExit: false,
    timeout: 60_000, // Should match the timeout in justfile
  }).then((result) => {
    cy.log(`Start workbench result: exit code ${result.code}`);
    if (result.stdout)
      cy.log(
        `Start workbench stdout: ${result.stdout.substring(0, 500)}${result.stdout.length > 500 ? "..." : ""}`,
      );
    if (result.stderr)
      cy.log(
        `Start workbench stderr: ${result.stderr.substring(0, 500)}${result.stderr.length > 500 ? "..." : ""}`,
      );
  });

  cy.log("Workbench container started and ready with clean data");
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

  // Wait for the session to start, a new session usually takes ~30s
  cy.contains(/Welcome — (?:.*— )?Positron/, { timeout: 60_000 }).should(
    "be.visible",
  );
  // Wait for the interpreter button to load at the top right
  cy.get('[aria-label="Select Interpreter Session"]', {
    timeout: 30_000,
  }).should("be.visible");

  cy.log("Positron session started and ready");
});

/**
 * Starts a Positron session in Workbench and creates a new Python project
 * This includes waiting for all necessary UI elements and session initialization
 *
 * @returns {string} The name of the created Python project
 */
Cypress.Commands.add("startWorkbenchPositronPythonProject", () => {
  cy.log("Starting Workbench Positron session and creating Python project");

  // Start a Positron session
  cy.startWorkbenchPositronSession();

  // Start a new Python project
  cy.get("button").contains("New").click();
  cy.get("li").contains("New Project...").focus();
  cy.get("li").contains("New Project...").click();
  cy.contains("Create New Project").should("be.visible");
  cy.get("label").contains("Python Project").click();
  cy.get("button").contains("Next").click();

  // Set a randomized project name
  cy.contains("Set project name").should("be.visible");
  const projectName = `test-${Date.now().toString(36).substring(4)}`;
  cy.contains("span", "Enter a name for your new Python Project")
    .parent("label")
    .find("input")
    .clear();
  cy.contains("span", "Enter a name for your new Python Project")
    .parent("label")
    .find("input")
    .type(projectName);
  cy.get("button").contains("Next").click();

  // Set up the Python environment
  cy.contains("Set up Python").should("be.visible");
  // Wait for the environment providers to load
  cy.get(".positron-button.drop-down-list-box", { timeout: 10_000 })
    .should("be.enabled")
    .should("contain", "Venv")
    .find(".dropdown-entry-title")
    .should("contain", "Venv")
    .and("be.visible");
  cy.get(".ok-cancel-back-action-bar")
    .find("button")
    .contains("Create")
    .click();
  cy.contains("Where would you like to").should("be.visible");
  cy.get("button").contains("Current Window").click();

  // Wait for the project to open and initialize extensions
  cy.get(`[aria-label="Explorer Section: ${projectName}"]`).should(
    "be.visible",
  );
  cy.get('[aria-label="Activating Extensions..."]', {
    timeout: 30_000,
  }).should("be.visible");
  cy.get('[aria-label="Activating Extensions..."]', {
    timeout: 30_000,
  }).should("not.exist");
  // Wait for the interpreter button to load at the top right
  cy.get('[aria-label="Select Interpreter Session"]', {
    timeout: 30_000,
  }).should("be.visible");

  // TODO need some other command to wait for more stuff in the IDE before proceeding
  // Observed a session failed to start and prevented the rest of the test from working

  cy.log(`Successfully created Python project: ${projectName}`);
});

Cypress.Commands.add(
  "createPositronDeployment",
  (
    projectDir, // string
    entrypointFile, // string
    title, // string
    verifyTomlCallback, // func({config: { filename: string, contents: {},}, contentRecord: { filename: string, contents: {}})
  ) => {
    // Temporarily ignore uncaught exception due to a vscode worker being cancelled at some point
    cy.on("uncaught:exception", () => false);

    // Open the entrypoint ahead of time for easier selection later
    // expand the subdirectory
    if (projectDir !== ".") {
      // Open the folder with our content
      cy.get("button").contains("Open Folder...").click();
      cy.get(".quick-input-widget").within(() => {
        cy.get(".quick-input-box input").should("be.visible");
        cy.get('.monaco-list-row[aria-label="static"]').click();
        cy.get(".quick-input-header a[role='button']").contains("OK").click();
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
    // Open Publisher, due to viewport size it is buried in the "..." menu
    cy.get(
      '[id="workbench.parts.activitybar"] .action-item[role="button"][aria-label="Additional Views"]',
      {
        timeout: 30_000,
      },
    ).click();
    // Wait for popup menu to appear
    cy.get('.monaco-menu .actions-container[role="menu"]')
      .should("be.visible")
      .within(() => {
        // Finally, double-click the Posit Publisher menu item
        cy.findByLabelText("Posit Publisher").dblclick();
      });

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
    // This has taken longer than 4 seconds on some laptops, so we're increasing the timeout
    cy.get(".quick-input-widget", { timeout: 10_000 }).should("be.visible");

    // Confirm we've got the correct sequence
    cy.get(".quick-input-titlebar").should("have.text", "Select Deployment");

    // Create a new deployment
    cy.get(".quick-input-list").contains("Create a New Deployment").click();

    // prompt for select entrypoint
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
      .should("contain.text", "Please provide the Posit Connect server's URL")
      .find("input")
      .type("http://connect-publisher-e2e:3939" + "{enter}");

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
