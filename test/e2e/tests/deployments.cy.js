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

    it("PCS Static Content Deployment", () => {
      cy.waitForPublisherIframe(); // Wait after triggering extension
      cy.debugIframes();
      cy.createPCSDeployment("static", "index.html", "static", (tomlFiles) => {
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
    it.skip("PCS ShinyApp Content Deployment", () => {
      cy.waitForPublisherIframe(); // Wait after triggering extension
      cy.debugIframes();
      cy.createPCSDeployment("shinyapp", "app.R", "ShinyApp", (tomlFiles) => {
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

  describe("Connect Cloud Deployments", () => {
    beforeEach(() => {
      cy.resetCredentials();
      cy.visit("/");
      const user = Cypress.env("pccConfig").pcc_user_ccqa3;
      cy.log("PCC user for setPCCCredential: " + JSON.stringify(user));
      cy.setPCCCredential(user, "pcc-deploy-credential");
      cy.findInPublisherWebview(
        '[data-automation="pcc-deploy-credential-list"]',
      )
        .find(".tree-item-title")
        .should("have.text", "pcc-deploy-credential");
    });

    afterEach(() => {
      cy.clearupDeployments("examples-shiny-python");
      cy.resetCredentials();
    });

    it("PCC Shiny Python Deployment", () => {
      cy.waitForPublisherIframe(); // Wait after triggering extension
      cy.debugIframes();
      // Select files to include in deployment
      const filesToSelect = ["data", "requirements.txt", "styles.css"];
      cy.createPCCDeployment(
        "examples-shiny-python",
        "app.py",
        "shiny-python-pcc",
        (tomlFiles) => {
          const config = tomlFiles.config.contents;
          expect(config.title).to.equal("shiny-python-pcc");
          expect(config.type).to.equal("python-shiny");
          expect(config.entrypoint).to.equal("app.py");
          // Check that all selected files are included
          ["/app.py", "/data", "/requirements.txt", "/styles.css"].forEach(
            (file) => {
              expect(config.files).to.include(file);
            },
          );
          // --- Add public access to the config TOML before deploy ---
          config.connect_cloud = config.connect_cloud || {};
          config.connect_cloud.access_control = { public_access: true };
          cy.savePublisherFile(tomlFiles.config.path, config);
        },
        filesToSelect,
      );
      cy.deployCurrentlySelected();
      cy.retryWithBackoff(
        () =>
          cy.findUniqueInPublisherWebview(
            '[data-automation="publisher-deployment-section"]',
          ),
        5,
        500,
      ).should("exist");
      // Load the deployment TOML to get the published URL
      cy.getPublisherTomlFilePaths("examples-shiny-python").then(
        (filePaths) => {
          cy.loadTomlFile(filePaths.contentRecord.path).then(
            (contentRecord) => {
              const publishedUrl = contentRecord.direct_url;
              const expectedTitle = "Restaurant tipping"; // Use the actual app title
              cy.log(
                "About to call confirmPCCPublishSuccess with URL: " +
                  publishedUrl +
                  " and title: " +
                  expectedTitle,
              );
              cy.task("confirmPCCPublishSuccess", {
                publishedUrl,
                expectedTitle,
              }).then((result) => {
                expect(
                  result.success,
                  result.error || "Publish confirmation failed",
                ).to.be.true;
              });
            },
          );
        },
      );
    });
  });
});
