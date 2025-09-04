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
      // Clean up any existing deployment files before starting
      cy.clearupDeployments("examples-shiny-python");
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
          // Don't save here - files haven't been selected yet!
        },
        filesToSelect,
      );

      // NOW add public access and save AFTER file selections are complete
      cy.getPublisherTomlFilePaths("examples-shiny-python").then(
        (filePaths) => {
          // Debug: Check file permissions before attempting to write
          cy.task(
            "print",
            `About to modify config file: ${filePaths.config.path}`,
          );

          // First check current permissions and ownership
          cy.exec(`ls -la "${filePaths.config.path}"`).then((result) => {
            cy.task("print", `Current file permissions: ${result.stdout}`);
          });

          // Try to make file writable with more aggressive approach
          cy.exec(
            `chmod 666 "${filePaths.config.path}" && chown $(whoami) "${filePaths.config.path}"`,
            { failOnNonZeroExit: false },
          ).then((result) => {
            cy.task(
              "print",
              `Permission fix result: ${JSON.stringify(result)}`,
            );
          });

          // Verify permissions after attempting to fix them
          cy.exec(`ls -la "${filePaths.config.path}"`).then((result) => {
            cy.task("print", `Permissions after fix attempt: ${result.stdout}`);
          });

          cy.loadTomlFile(filePaths.config.path).then((config) => {
            // Add public access to the config TOML before deploy
            config.connect_cloud = config.connect_cloud || {};
            config.connect_cloud.access_control = { public_access: true };

            cy.task(
              "print",
              `About to append connect_cloud section using Docker exec`,
            );

            // Use Docker exec to append the connect_cloud section to the file
            const dockerPath = filePaths.config.path.replace(
              "content-workspace/",
              "/home/coder/workspace/",
            );

            cy.exec(
              `docker exec publisher-e2e.code-server bash -c "echo -e '\\n[connect_cloud]\\n[connect_cloud.access_control]\\npublic_access = true' >> '${dockerPath}'"`,
            ).then((result) => {
              cy.task(
                "print",
                `Docker file append result: ${JSON.stringify(result)}`,
              );
              if (result.code !== 0) {
                throw new Error(
                  `Failed to append to config via Docker: ${result.stderr}`,
                );
              }
            });

            // Verify the file was actually modified
            cy.loadTomlFile(filePaths.config.path).then((updatedConfig) => {
              cy.task(
                "print",
                `Verified config after save: ${JSON.stringify(updatedConfig, null, 2)}`,
              );
            });
          });
        },
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
