// Copyright (C) 2026 by Posit Software, PBC.

// Purpose: Verify file include/exclude toggling in the project files tree.
// - Creates a PCS deployment for fastapi-simple.
// - Unchecks requirements.txt in the project files tree.
// - Verifies the TOML config no longer includes /requirements.txt.
// - Re-checks requirements.txt.
// - Verifies the TOML config includes /requirements.txt again.
describe("File Include/Exclude Section", () => {
  const projectDir = "fastapi-simple";

  before(() => {
    cy.initializeConnect();
  });

  beforeEach(() => {
    cy.visit("/");
    cy.getPublisherSidebarIcon().click();
    cy.waitForPublisherIframe();
    cy.debugIframes();
  });

  afterEach(() => {
    cy.clearupDeployments(projectDir);
  });

  it("Toggle file inclusion via checkbox updates TOML config", () => {
    cy.expectInitialPublisherState();

    cy.createPCSDeployment(
      projectDir,
      "fastapi-main.py",
      "fastapi-file-toggle",
      (tomlFiles) => {
        const { contents: config } = tomlFiles.config;
        expect(config.title).to.equal("fastapi-file-toggle");
        expect(config.files).to.include("/requirements.txt");
        return tomlFiles;
      },
    );

    // Step 1: Find requirements.txt in the project files tree and uncheck it
    cy.retryWithBackoff(
      () =>
        cy
          .publisherWebview()
          .find('[data-automation="project-files"]')
          .contains(".tree-item-title", "requirements.txt")
          .closest(".tree-item")
          .find('.vscode-checkbox input[type="checkbox"]'),
      10,
      1000,
    )
      .should("exist")
      .should("be.visible")
      .then(($checkbox) => {
        // Should be checked initially
        expect($checkbox.prop("checked")).to.be.true;
        cy.wrap($checkbox).click({ force: true });
        // eslint-disable-next-line cypress/no-unnecessary-waiting
        cy.wait(500);
        cy.wrap($checkbox).should("not.be.checked");
      });

    // Step 2: Verify TOML no longer includes requirements.txt
    // Wait for the async TOML update to propagate
    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(1000);
    cy.getPublisherTomlFilePaths(projectDir).then((filePaths) => {
      cy.loadTomlFile(filePaths.config.path).then((config) => {
        expect(config.files).to.not.include("/requirements.txt");
      });
    });

    // Step 3: Re-check requirements.txt
    cy.retryWithBackoff(
      () =>
        cy
          .publisherWebview()
          .find('[data-automation="project-files"]')
          .contains(".tree-item-title", "requirements.txt")
          .closest(".tree-item")
          .find('.vscode-checkbox input[type="checkbox"]'),
      10,
      1000,
    )
      .should("exist")
      .should("be.visible")
      .then(($checkbox) => {
        expect($checkbox.prop("checked")).to.be.false;
        cy.wrap($checkbox).click({ force: true });
        // eslint-disable-next-line cypress/no-unnecessary-waiting
        cy.wait(500);
        cy.wrap($checkbox).should("be.checked");
      });

    // Step 4: Verify TOML includes requirements.txt again
    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(1000);
    cy.getPublisherTomlFilePaths(projectDir).then((filePaths) => {
      cy.loadTomlFile(filePaths.config.path).then((config) => {
        expect(config.files).to.include("/requirements.txt");
      });
    });
  });
});
