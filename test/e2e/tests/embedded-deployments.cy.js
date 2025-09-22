// Copyright (C) 2025 by Posit Software, PBC.

// Purpose: Exercise embedded PCS deployments (FastAPI) from workspace root and subdirectory.
// - Validates TOML fields (title, type, entrypoint) and required files (order-agnostic).
// - Demonstrates writing additional TOML content (Python version) pre-deploy.
describe("Embedded Deployments Section", () => {
  // Global setup - run once for entire test suite
  before(() => {
    cy.resetConnect();
    cy.clearupDeployments();
    cy.setAdminCredentials(); // Set up admin credential once
  });

  beforeEach(() => {
    cy.clearupDeployments();
    cy.visit("/");
    cy.getPublisherSidebarIcon().click();
    cy.waitForPublisherIframe();
    cy.debugIframes();
  });

  describe("Create PCS Deployments", () => {
    afterEach(() => {
      cy.clearupDeployments();
    });

    it("PCS fastapi at top of workspace", () => {
      // Ensure Publisher is in the expected initial state
      cy.expectInitialPublisherState();

      cy.createPCSDeployment(
        ".",
        "simple.py",
        "fastapi-base-directory",
        (tomlFiles) => {
          const { contents: config } = tomlFiles.config;
          const { name: cfgName } = tomlFiles.config;
          const { name: recName } = tomlFiles.contentRecord;

          expect(config.title).to.equal("fastapi-base-directory");
          expect(config.type).to.equal("python-fastapi");
          expect(config.entrypoint).to.equal("simple.py");

          // Assert required files without relying on order
          expect(config.files).to.include.members([
            "/simple.py",
            "/requirements.txt",
            `/.posit/publish/${cfgName}`,
            `/.posit/publish/deployments/${recName}`,
          ]);
          return tomlFiles;
        },
      )
        .then((tomlFiles) => {
          return cy.writeTomlFile(tomlFiles.config.path, "version = '3.11.3'");
        })
        .deployCurrentlySelected();

      cy.retryWithBackoff(
        () =>
          cy.findUniqueInPublisherWebview(
            '[data-automation="publisher-deployment-section"]',
          ),
        5,
        500,
      ).should("exist");
    });

    it("PCS fastAPI in subdirectory of workspace", () => {
      // Ensure Publisher is in the expected initial state
      cy.expectInitialPublisherState();

      cy.createPCSDeployment(
        "fastapi-simple",
        "fastapi-main.py",
        "fastapi-sub-directory",
        (tomlFiles) => {
          const { contents: config } = tomlFiles.config;
          const { name: cfgName } = tomlFiles.config;
          const { name: recName } = tomlFiles.contentRecord;

          expect(config.title).to.equal("fastapi-sub-directory");
          expect(config.type).to.equal("python-fastapi");
          expect(config.entrypoint).to.equal("fastapi-main.py");

          // Order-agnostic required files
          expect(config.files).to.include.members([
            "/fastapi-main.py",
            "/requirements.txt",
            `/.posit/publish/${cfgName}`,
            `/.posit/publish/deployments/${recName}`,
          ]);
          return tomlFiles;
        },
      )
        .then((tomlFiles) => {
          return cy.writeTomlFile(tomlFiles.config.path, "version = '3.11.3'");
        })
        .deployCurrentlySelected();

      cy.retryWithBackoff(
        () =>
          cy.findUniqueInPublisherWebview(
            '[data-automation="publisher-deployment-section"]',
          ),
        5,
        500,
      ).should("exist");
    });
  });
});
