// Copyright (C) 2025 by Posit Software, PBC.

describe("Deployments Section", () => {
  beforeEach(() => {
    cy.resetConnect();
    cy.setAdminCredentials();
    cy.clearupDeployments("static");
    cy.visit("/");
  });

  it("Static Content Deployment", () => {
    cy.createDeployment("static", "index.html", "static", (configFile) => {
      expect(configFile.contents.title).to.equal("static");
      expect(configFile.contents.type).to.equal("html");
      expect(configFile.contents.entrypoint).to.equal("index.html");
      expect(configFile.contents.files[0]).to.equal("/index.html");
      expect(configFile.contents.files[1]).to.equal(
        `/.posit/publish/${configFile.fileName}`,
      );
      expect(configFile.contents.files[2]).to.match(
        /\/.posit\/publish\/deployments\/deployment-[A-Z0-9]{4}\.toml/,
      );
    }).deployCurrentlySelected();
  });

  // Unable to run this, as the docker image for the code server does not have R installed.
  it.skip("ShinyApp Content Deployment", () => {
    cy.createDeployment("shinyapp", "app.R", "ShinyApp", (configFile) => {
      expect(configFile.contents.title).to.equal("ShinyApp");
      expect(configFile.contents.type).to.equal("r-shiny");
      expect(configFile.contents.entrypoint).to.equal("app.R");
      expect(configFile.contents.files[0]).to.equal("/app.R");
      expect(configFile.contents.files[1]).to.equal("/renv.lock");
      expect(configFile.contents.files[2]).to.equal(
        `/.posit/publish/${configFile.fileName}`,
      );
      expect(configFile.contents.files[3]).to.match(
        /\/.posit\/publish\/deployments\/deployment-[A-Z0-9]{4}\.toml/,
      );
    }).deployCurrentlySelected();
  });
});
