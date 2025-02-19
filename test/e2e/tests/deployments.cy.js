// Copyright (C) 2025 by Posit Software, PBC.

describe("Deployments Section", () => {
  beforeEach(() => {
    cy.resetConnect();
    cy.setAdminCredentials();
    cy.clearupDeployments("static");
    cy.visit("/");
  });

  it("Static Content Deployment", () => {
    cy.createDeployment("static", "index.html", "static", (tomlFiles) => {
      const config = tomlFiles.config.contents;
      expect(config.title).to.equal("static");
      expect(config.type).to.equal("html");
      expect(config.entrypoint).to.equal("index.html");
      expect(config.files[0]).to.equal("/index.html");
      expect(config.files[1]).to.equal(
        `/.posit/publish/${tomlFiles.config.name}`,
      );
      expect(config.files[2]).to.equal(
        `/.posit/publish/deployments/${tomlFiles.contentRecord.name}`,
      );
    }).deployCurrentlySelected();
  });

  // Unable to run this, as the docker image for the code server does not have R installed.
  it.skip("ShinyApp Content Deployment", () => {
    cy.createDeployment("shinyapp", "app.R", "ShinyApp", (tomlFiles) => {
      const config = tomlFiles.config.contents;
      expect(config.title).to.equal("ShinyApp");
      expect(config.type).to.equal("r-shiny");
      expect(config.entrypoint).to.equal("app.R");
      expect(config.files[0]).to.equal("/app.R");
      expect(config.files[1]).to.equal("/renv.lock");
      expect(config.files[2]).to.equal(
        `/.posit/publish/${tomlFiles.config.name}`,
      );
      expect(config.files[3]).to.equal(
        `/.posit/publish/deployments/${tomlFiles.contentRecord.name}`,
      );
    }).deployCurrentlySelected();
  });
});
