// Copyright (C) 2025 by Posit Software, PBC.

const WORKBENCH_BASE_URL = Cypress.env("WORKBENCH_URL");

describe("Workbench > Positron", { baseUrl: WORKBENCH_BASE_URL }, () => {
  // Each test must set this var to enable project-specific cleanup in afterEach
  let projectDir;

  beforeEach(() => {
    cy.resetConnect();
    cy.setAdminCredentials();

    cy.cleanupAndRestartWorkbench();
    cy.visitAndLoginToWorkbench();
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
