// Copyright (C) 2025 by Posit Software, PBC.

// Purpose: Verify redeployment workflow - deploy, modify content, redeploy.
// - Deploys static content, captures initial bundle_id.
// - Modifies index.html inside the container.
// - Redeploys and verifies: same record file (no new record created), updated bundle_id.
describe("Redeployment Section", () => {
  const projectDir = "static";
  const originalHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Publisher e2e Test - Static Content</title>
  </head>
  <body>
    <h1>Publisher e2e Test - Static Content</h1>
  </body>
</html>
`;

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
    // Restore original index.html inside the container
    cy.modifyFileInContainer(
      "/home/coder/workspace/static/index.html",
      originalHtml,
    );
    cy.clearupDeployments(projectDir);
  });

  it("Redeploy after content modification uses same deployment record", () => {
    cy.expectInitialPublisherState();

    // Step 1: Create deployment and deploy
    cy.createPCSDeployment(
      projectDir,
      "index.html",
      "static-redeploy-test",
      (tomlFiles) => {
        const { contents: config } = tomlFiles.config;
        expect(config.title).to.equal("static-redeploy-test");
        expect(config.type).to.equal("html");
        expect(config.entrypoint).to.equal("index.html");
        return tomlFiles;
      },
    ).deployCurrentlySelected();

    // Step 2: Capture initial deployment record state
    let initialBundleId;
    cy.getPublisherTomlFilePaths(projectDir).then((filePaths) => {
      cy.loadTomlFile(filePaths.contentRecord.path).then((contentRecord) => {
        initialBundleId = contentRecord.bundle_id;
        expect(initialBundleId).to.exist;
      });
    });

    // Verify exactly 1 deployment record file
    cy.countDeploymentRecordFiles(projectDir).then((count) => {
      expect(count).to.equal(1);
    });

    // Step 3: Modify content inside the container
    const modifiedHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Publisher e2e Test - Static Content (Modified)</title>
  </head>
  <body>
    <h1>Publisher e2e Test - Static Content (Modified)</h1>
  </body>
</html>
`;
    cy.modifyFileInContainer(
      "/home/coder/workspace/static/index.html",
      modifiedHtml,
    );

    // Step 4: Redeploy
    cy.deployCurrentlySelected();

    // Step 5: Verify same record file (still exactly 1)
    cy.countDeploymentRecordFiles(projectDir).then((count) => {
      expect(count).to.equal(1);
    });

    // Step 6: Verify bundle_id changed (new bundle uploaded)
    cy.getPublisherTomlFilePaths(projectDir).then((filePaths) => {
      cy.loadTomlFile(filePaths.contentRecord.path).then((contentRecord) => {
        expect(contentRecord.bundle_id).to.exist;
        expect(contentRecord.bundle_id).to.not.equal(initialBundleId);
      });
    });
  });
});
