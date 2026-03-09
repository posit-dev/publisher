// Copyright (C) 2025 by Posit Software, PBC.

// Purpose: Verify deployment status and post-deployment UI elements.
// - Deploys static content.
// - Asserts deploy-status shows "Last Deployment Successful".
// - Verifies "View Content" button is visible.
// - Validates deployment record contains expected fields (dashboard_url, direct_url, deployed_at, bundle_id).
describe("Deployment Status Section", () => {
  const projectDir = "static";

  before(() => {
    cy.initializeConnect();
  });

  beforeEach(() => {
    cy.visit("/");
    cy.getPublisherSidebarIcon().click();
    cy.waitForPublisherIframe();
    cy.debugIframes();
  });

  afterEach(() => {
    cy.clearupDeployments(projectDir);
  });

  it("Shows deployment status and View Content button after successful deploy", () => {
    cy.expectInitialPublisherState();

    // Deploy static content
    cy.createPCSDeployment(
      projectDir,
      "index.html",
      "static-status-test",
      (tomlFiles) => {
        const { contents: config } = tomlFiles.config;
        expect(config.title).to.equal("static-status-test");
        expect(config.type).to.equal("html");
        return tomlFiles;
      },
    ).deployCurrentlySelected();

    // Verify deploy-status shows success
    cy.findInPublisherWebview('[data-automation="deploy-status"]').should(
      "contain.text",
      "Last Deployment Successful",
    );

    // Verify "View Content" button is visible
    cy.publisherWebview()
      .findByText("View Content")
      .should("be.visible");

    // Verify deployment record has expected fields
    cy.getPublisherTomlFilePaths(projectDir).then((filePaths) => {
      cy.loadTomlFile(filePaths.contentRecord.path).then((contentRecord) => {
        expect(contentRecord.dashboard_url).to.exist;
        expect(contentRecord.dashboard_url).to.be.a("string");
        expect(contentRecord.dashboard_url).to.not.be.empty;

        expect(contentRecord.direct_url).to.exist;
        expect(contentRecord.direct_url).to.be.a("string");
        expect(contentRecord.direct_url).to.not.be.empty;

        expect(contentRecord.deployed_at).to.exist;
        expect(contentRecord.deployed_at).to.be.a("string");
        expect(contentRecord.deployed_at).to.not.be.empty;

        expect(contentRecord.bundle_id).to.exist;
      });
    });
  });
});
