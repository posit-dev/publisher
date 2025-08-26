// Copyright (C) 2025 by Posit Software, PBC.

describe("Deployments Section", () => {
  describe("Connect Server Deployments", () => {
    beforeEach(() => {
      cy.resetConnect();
      cy.setAdminCredentials();
      cy.visit("/");
    });

    afterEach(() => {
      cy.clearupDeployments("static");
    });

    it("Static Content Deployment", () => {
      cy.waitForPublisherIframe(); // Wait after triggering extension
      cy.debugIframes();
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
      cy.retryWithBackoff(
        () =>
          cy.findUniqueInPublisherWebview(
            '[data-automation="publisher-deployment-section"]',
          ),
        5,
        500,
      ).should("exist");
    });

    // Unable to run this,
    // as we will need to install the renv package - install.packages("renv")
    // as well as call renv::restore(), before we can deploy. This will use
    // the current version of R within our code-server image, so we'll have an
    // extra bit of work when we want to change that version around to different
    // ones.
    it.skip("ShinyApp Content Deployment", () => {
      cy.waitForPublisherIframe(); // Wait after triggering extension
      cy.debugIframes();
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

  describe("PCC Deployments", () => {
    beforeEach(() => {
      cy.resetConnect();
      cy.resetCredentials();
      cy.visit("/");
    });

    it("writes a PCC credential file via setPCCCredentials", () => {
      const user = Cypress.env("pccConfig").pcc_user_ccqa3;
      cy.log("About to call setPCCCredentials with:");
      cy.log("Email: " + user.email);
      cy.log("Env: " + (Cypress.env("CONNECT_CLOUD_ENV") || "staging"));
      cy.setPCCCredentials({
        email: user.email,
        password: user.auth.password,
        nickname: "pcc-deploy-credential",
      });
      cy.log("Called setPCCCredentials");
      // Confirm the file was written and contains the expected nickname
      cy.readFile("e2e-test.connect-credentials").should(
        "include",
        "[credentials.pcc-deploy-credential]",
      );
    });
  });
});
