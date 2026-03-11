// Copyright (C) 2026 by Posit Software, PBC.

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

    // Step 2: Capture initial deployment record state (path and bundle_id)
    let initialBundleId;
    let recordFilePath;
    cy.getPublisherTomlFilePaths(projectDir).then((filePaths) => {
      recordFilePath = filePaths.contentRecord.path;
      cy.loadTomlFile(filePaths.contentRecord.path).then((contentRecord) => {
        initialBundleId = contentRecord.bundle_id;
        expect(initialBundleId).to.exist;
      });
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

    // Step 5: Verify same record file is reused with updated bundle_id
    cy.then(() => {
      // The same record file path should still exist
      cy.exec(`cat "${recordFilePath}"`, { failOnNonZeroExit: false }).then(
        (result) => {
          expect(result.exitCode, "Record file still exists").to.equal(0);
        },
      );

      // Load and verify bundle_id changed (proves redeployment updated the record)
      cy.loadTomlFile(recordFilePath).then((contentRecord) => {
        expect(contentRecord.bundle_id).to.exist;
        expect(contentRecord.bundle_id).to.not.equal(initialBundleId);
      });
    });
  });
});
