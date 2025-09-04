// Copyright (C) 2025 by Posit Software, PBC.

describe("Create PCS Deployments", () => {
  beforeEach(() => {
    cy.resetConnect();
    cy.setAdminCredentials();
    cy.visit("/");
    cy.getPublisherSidebarIcon().click();
  });

  afterEach(() => {
    cy.clearupDeployments(".");
    cy.clearupDeployments("fastapi-simple");
  });

  it("PCS fastapi at top of workspace", () => {
    cy.waitForPublisherIframe();
    cy.debugIframes();
    cy.createPCSDeployment(
      ".",
      "simple.py",
      "fastapi-base-directory",
      (tomlFiles) => {
        const config = tomlFiles.config.contents;
        expect(config.title).to.equal("fastapi-base-directory");
        expect(config.type).to.equal("python-fastapi");
        expect(config.entrypoint).to.equal("simple.py");
        expect(config.files[0]).to.equal("/simple.py");
        expect(config.files[1]).to.equal("/requirements.txt");
        expect(config.files[2]).to.equal(
          `/.posit/publish/${tomlFiles.config.name}`,
        );
        expect(config.files[3]).to.equal(
          `/.posit/publish/deployments/${tomlFiles.contentRecord.name}`,
        );
        return tomlFiles;
      },
    )
      .then((tomlFiles) => {
        return cy.writeTomlFile(tomlFiles.config.path, "version = '3.11.3'");
      })
      .then(() => {
        return cy.log("File saved.");
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
    cy.waitForPublisherIframe(); // Wait after triggering extension
    cy.debugIframes();
    cy.createPCSDeployment(
      "fastapi-simple",
      "fastapi-main.py",
      "fastapi-sub-directory",
      (tomlFiles) => {
        const config = tomlFiles.config.contents;
        expect(config.title).to.equal("fastapi-sub-directory");
        expect(config.type).to.equal("python-fastapi");
        expect(config.entrypoint).to.equal("fastapi-main.py");
        expect(config.files[0]).to.equal("/fastapi-main.py");
        expect(config.files[1]).to.equal("/requirements.txt");
        expect(config.files[2]).to.equal(
          `/.posit/publish/${tomlFiles.config.name}`,
        );
        expect(config.files[3]).to.equal(
          `/.posit/publish/deployments/${tomlFiles.contentRecord.name}`,
        );
        return tomlFiles;
      },
    )
      .then((tomlFiles) => {
        return cy.writeTomlFile(tomlFiles.config.path, "version = '3.11.3'");
      })
      .then(() => {
        return cy.log("File saved.");
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
