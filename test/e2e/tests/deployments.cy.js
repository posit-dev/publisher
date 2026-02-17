// Copyright (C) 2025 by Posit Software, PBC.

// Purpose: Positive-path deployment creation for PCS and PCC.
// - PCS Static: creates a static content deployment and validates TOML contents.
// - PCC Shiny Python: creates a PCC deployment, selects additional files,
//   modifies TOML for public access, deploys, and confirms published app via Playwright.
describe("Deployments Section", () => {
  // Global setup for all deployment tests
  before(() => {
    cy.initializeConnect();
  });

  describe("Connect Server Deployments", () => {
    beforeEach(() => {
      // Only light reset operations
      cy.visit("/");
      cy.getPublisherSidebarIcon().click();
      cy.waitForPublisherIframe();
      cy.debugIframes();
    });

    afterEach(() => {
      cy.clearupDeployments();
    });

    it("PCS Static Content Deployment", () => {
      // Uses createPCSDeployment + deployCurrentlySelected.
      // Asserts config fields and files are present (order-agnostic).

      // Ensure Publisher is in the expected initial state
      cy.expectInitialPublisherState();

      cy.createPCSDeployment("static", "index.html", "static", (tomlFiles) => {
        const { contents: config } = tomlFiles.config;
        const { name: cfgName } = tomlFiles.config;
        const { name: recName } = tomlFiles.contentRecord;

        expect(config.title).to.equal("static");
        expect(config.type).to.equal("html");
        expect(config.entrypoint).to.equal("index.html");

        // Assert required files without relying on order
        expect(config.files).to.include.members([
          "/index.html",
          `/.posit/publish/${cfgName}`,
          `/.posit/publish/deployments/${recName}`,
        ]);
      }).deployCurrentlySelected();

      cy.findUniqueInPublisherWebview(
        '[data-automation="publisher-deployment-section"]',
      ).should("exist");
    });

    it("Last selected deployment loads on initialization", () => {
      // Regression test for https://github.com/posit-dev/publisher/issues/2473
      // Verifies that the last selected deployment is restored after reload.

      const deploymentTitle = "last-selection-test";

      // Ensure Publisher is in the expected initial state
      cy.expectInitialPublisherState();

      // Create a deployment (this also selects it)
      cy.createPCSDeployment(
        "static",
        "index.html",
        deploymentTitle,
        (tomlFiles) => {
          const { contents: config } = tomlFiles.config;
          expect(config.title).to.equal(deploymentTitle);
        },
      );

      // Verify deployment is currently selected (entrypoint-label visible, not select-deployment)
      cy.retryWithBackoff(
        () => cy.findInPublisherWebview('[data-automation="entrypoint-label"]'),
        5,
        500,
      ).should("exist");

      // Reload the page to simulate VS Code restart
      cy.reload();

      // Re-open the Publisher sidebar (matching beforeEach pattern)
      cy.getPublisherSidebarIcon().click();
      cy.waitForPublisherIframe();
      cy.debugIframes();

      // Wait for the Publisher webview to fully initialize after reload.
      // The extension needs time to: load saved state, restore last selection.
      // Use a longer retry with more attempts to handle slow CI environments.
      cy.retryWithBackoff(
        () =>
          cy.publisherWebview().then(($webview) => {
            // Check if either entrypoint-label OR select-deployment is visible
            // This tells us the webview has finished initializing
            const entrypoint = $webview.find(
              '[data-automation="entrypoint-label"]',
            );
            const selectBtn = $webview.find(
              '[data-automation="select-deployment"]',
            );
            if (entrypoint.length > 0 || selectBtn.length > 0) {
              return cy.wrap($webview);
            }
            return Cypress.$();
          }),
        15,
        1000,
      ).should("exist");

      // Now verify the last selected deployment is automatically loaded
      // If working correctly: entrypoint-label should show with the deployment title
      // If broken: select-deployment would show with "Select..." instead
      cy.findInPublisherWebview('[data-automation="entrypoint-label"]')
        .should("exist")
        .and("contain.text", deploymentTitle);

      // Also verify the deployment section is present
      cy.findInPublisherWebview(
        '[data-automation="publisher-deployment-section"]',
      ).should("exist");

      // Explicit cleanup to ensure other tests aren't affected
      cy.clearupDeployments("static");
    });

    // Unable to run this,
    // as we will need to install the renv package - install.packages("renv")
    // as well as call renv::restore(), before we can deploy. This will use
    // the current version of R within our code-server image, so we'll have an
    // extra bit of work when we want to change that version around to different
    // ones.
    it.skip("PCS ShinyApp Content Deployment", () => {
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

      cy.findUniqueInPublisherWebview(
        '[data-automation="publisher-deployment-section"]',
      ).should("exist");
    });
  });

  describe("Connect Cloud Deployments", () => {
    it("PCC Shiny Python Deployment @pcc", () => {
      // Setup - moved from beforeEach to avoid running when @pcc tests are filtered
      cy.resetCredentials();
      cy.clearupDeployments();
      cy.visit("/");
      const user = Cypress.env("pccConfig").pcc_user_ccqa3;
      cy.log("PCC user for setPCCCredential: " + JSON.stringify(user));
      cy.setPCCCredential(user, "pcc-deploy-credential");
      cy.toggleCredentialsSection();
      cy.refreshCredentials();
      cy.findInPublisherWebview(
        '[data-automation="pcc-deploy-credential-list"]',
      )
        .find(".tree-item-title")
        .should("have.text", "pcc-deploy-credential");

      // Ensure Publisher is in the expected initial state
      cy.expectInitialPublisherState();

      // Select files to include in deployment
      const filesToSelect = ["data", "README.md", "styles.css"];
      cy.createPCCDeployment(
        "examples-shiny-python",
        "app.py",
        "shiny-python-pcc",
        (tomlFiles) => {
          const config = tomlFiles.config.contents;
          expect(config.title).to.equal("shiny-python-pcc");
          expect(config.type).to.equal("python-shiny");
          expect(config.entrypoint).to.equal("app.py");
          // Check that all selected files are included (note: requirements.txt is auto-managed)
          ["/app.py", "/data", "/README.md", "/styles.css"].forEach((file) => {
            expect(config.files).to.include(file);
          });
        },
        filesToSelect,
      );

      // Set public access via helper and then deploy
      cy.getPublisherTomlFilePaths("examples-shiny-python").then(
        ({ config }) => {
          // Write both Python version and public access in one operation
          return cy.writeTomlFile(
            config.path,
            "version = '3.11'\n[connect_cloud]\n[connect_cloud.access_control]\npublic_access = true",
          );
        },
      );

      cy.deployCurrentlySelected();

      cy.findUniqueInPublisherWebview(
        '[data-automation="publisher-deployment-section"]',
      ).should("exist");

      // Load the deployment TOML to get the published URL and verify app
      cy.getPublisherTomlFilePaths("examples-shiny-python").then(
        (filePaths) => {
          cy.loadTomlFile(filePaths.contentRecord.path).then(
            (contentRecord) => {
              const publishedUrl = contentRecord.direct_url;

              const expectedTitle = "Restaurant tipping";
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
