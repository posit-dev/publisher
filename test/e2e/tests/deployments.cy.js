// Copyright (C) 2025 by Posit Software, PBC.

// Purpose: Positive-path deployment creation for PCS and PCC.
// - PCS Static: creates a static content deployment and validates TOML contents.
// - PCC Static: creates a PCC deployment with static HTML, modifies TOML for
//   public access, deploys, and confirms the deployment record has a direct_url.
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
  });

  describe("Connect Cloud Deployments", () => {
    it("PCC Static Content Deployment @pcc", () => {
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

      cy.createPCCDeployment(
        "static",
        "index.html",
        "static-pcc",
        (tomlFiles) => {
          const config = tomlFiles.config.contents;
          expect(config.title).to.equal("static-pcc");
          expect(config.type).to.equal("html");
          expect(config.entrypoint).to.equal("index.html");
        },
      );

      // Set public access via helper and then deploy
      cy.getPublisherTomlFilePaths("static").then(({ config }) => {
        return cy.writeTomlFile(
          config.path,
          "[connect_cloud]\n[connect_cloud.access_control]\npublic_access = true",
        );
      });

      cy.deployCurrentlySelected();

      cy.findUniqueInPublisherWebview(
        '[data-automation="publisher-deployment-section"]',
      ).should("exist");

      // Verify the deployment record has a direct_url
      cy.getPublisherTomlFilePaths("static").then((filePaths) => {
        cy.loadTomlFile(filePaths.contentRecord.path).then(
          (contentRecord) => {
            expect(contentRecord.direct_url).to.be.a("string").and.not.be
              .empty;
          },
        );
      });
    });
  });
});
