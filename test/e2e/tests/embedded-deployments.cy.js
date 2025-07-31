// Copyright (C) 2025 by Posit Software, PBC.

describe("Create Deployments", () => {
  beforeEach(() => {
    cy.resetConnect();
    cy.setAdminCredentials();
    cy.visit("/");
  });

  afterEach(() => {
    cy.clearupDeployments(".");
    cy.clearupDeployments("fastapi-simple");
  });

  it("fastapi at top of workspace", () => {
    cy.waitForPublisherIframe(); // Wait after triggering extension
    cy.debugIframes();
    cy.createDeployment(
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
        tomlFiles.config.contents.python.version = "3.11.3";
        return cy.savePublisherFile(
          tomlFiles.config.path,
          tomlFiles.config.contents,
        );
      })
      .then(() => {
        return cy.log("File saved.");
      })
      .deployCurrentlySelected();
  });

  it("fastAPI in subdirectory of workspace", () => {
    cy.waitForPublisherIframe(); // Wait after triggering extension
    cy.debugIframes();
    cy.createDeployment(
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
        tomlFiles.config.contents.python.version = "3.11.3";
        return cy.savePublisherFile(
          tomlFiles.config.path,
          tomlFiles.config.contents,
        );
      })
      .then(() => {
        return cy.log("File saved.");
      })
      .deployCurrentlySelected();
  });
});
