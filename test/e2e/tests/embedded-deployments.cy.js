// Copyright (C) 2025 by Posit Software, PBC.

describe("Create Deployments", () => {
  beforeEach(() => {
    cy.resetConnect();
    cy.setAdminCredentials();
    cy.clearupDeployments(".");
    cy.clearupDeployments("fastapi-simple");
    cy.visit("/");
  });

  it("fastapi at top of workspace", () => {
    cy.createDeployment(
      ".",
      "simple.py",
      "fastapi-base-directory",
      (configFile) => {
        expect(configFile.contents.title).to.equal("fastapi-base-directory");
        expect(configFile.contents.type).to.equal("python-fastapi");
        expect(configFile.contents.entrypoint).to.equal("simple.py");
        expect(configFile.contents.files[0]).to.equal("/simple.py");
        expect(configFile.contents.files[1]).to.equal("/requirements.txt");
        expect(configFile.contents.files[2]).to.equal(
          `/.posit/publish/${configFile.fileName}`,
        );
        //   /\/.posit\/publish\/fastapi-base-directory-[A-Z0-9]{4}\.toml/,
        // );
        expect(configFile.contents.files[3]).to.match(
          /\/.posit\/publish\/deployments\/deployment-[A-Z0-9]{4}\.toml/,
        );
        return configFile;
      },
    )
      .then((configFile) => {
        configFile.contents.python.version = "3.11.3";
        return cy.savePublisherFile(
          `.posit/publish/${configFile.fileName}`,
          configFile.contents,
        );
      })
      .then(() => {
        return cy.log("File saved.");
      })
      .deployCurrentlySelected();
  });

  it("fastAPI in subdirectory of workspace", () => {
    cy.createDeployment(
      "fastapi-simple",
      "fastapi-main.py",
      "fastapi-sub-directory",
      (configFile) => {
        expect(configFile.contents.title).to.equal("fastapi-sub-directory");
        expect(configFile.contents.type).to.equal("python-fastapi");
        expect(configFile.contents.entrypoint).to.equal("fastapi-main.py");
        expect(configFile.contents.files[0]).to.equal("/fastapi-main.py");
        expect(configFile.contents.files[1]).to.equal("/requirements.txt");
        expect(configFile.contents.files[2]).to.equal(
          `/.posit/publish/${configFile.fileName}`,
        );
        //   /\/.posit\/publish\/fastapi-base-directory-[A-Z0-9]{4}\.toml/,
        // );
        expect(configFile.contents.files[3]).to.match(
          /\/.posit\/publish\/deployments\/deployment-[A-Z0-9]{4}\.toml/,
        );
        return configFile;
      },
    )
      .then((configFile) => {
        configFile.contents.python.version = "3.11.3";
        return cy.savePublisherFile(
          `fastapi-simple/.posit/publish/${configFile.fileName}`,
          configFile.contents,
        );
      })
      .then(() => {
        return cy.log("File saved.");
      })
      .deployCurrentlySelected();
  });
});
