// Copyright (C) 2026 by Posit Software, PBC.

// Purpose: Verify Quarto document deployment via PCS.
// - Creates a deployment for a markdown-only Quarto doc (no Python/R engine).
// - Validates TOML config: type, entrypoint, files include _quarto.yml.
// - Deploys and verifies success.
describe("Quarto Deployment Section", () => {
  const projectDir = "quarto-doc";

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

  it("PCS Quarto Document Deployment", () => {
    cy.expectInitialPublisherState();

    cy.createPCSDeployment(
      projectDir,
      "quarto-doc.qmd",
      "quarto-doc-test",
      (tomlFiles) => {
        const { contents: config } = tomlFiles.config;
        const { name: cfgName } = tomlFiles.config;
        const { name: recName } = tomlFiles.contentRecord;

        expect(config.title).to.equal("quarto-doc-test");
        expect(config.type).to.equal("quarto-static");
        expect(config.entrypoint).to.equal("quarto-doc.qmd");

        // Assert required files without relying on order
        expect(config.files).to.include.members([
          "/quarto-doc.qmd",
          "/_quarto.yml",
          `/.posit/publish/${cfgName}`,
          `/.posit/publish/deployments/${recName}`,
        ]);
        return tomlFiles;
      },
    ).deployCurrentlySelected();

    cy.findUniqueInPublisherWebview(
      '[data-automation="publisher-deployment-section"]',
    ).should("exist");
  });
});
