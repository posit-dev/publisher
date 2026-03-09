// Copyright (C) 2025 by Posit Software, PBC.

// Purpose: Verify Python packages section displays detected packages.
// - Creates a PCS deployment for fastapi-simple.
// - Asserts the python-packages section exists in the sidebar.
// - Verifies "fastapi" appears in the package list (from requirements.txt).
describe("Package Management Section", () => {
  const projectDir = "fastapi-simple";

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

  it("Python packages section shows detected packages", () => {
    cy.skipIfConnectVersionBefore("2025.03");

    cy.expectInitialPublisherState();

    cy.createPCSDeployment(
      projectDir,
      "fastapi-main.py",
      "fastapi-packages-test",
      (tomlFiles) => {
        const { contents: config } = tomlFiles.config;
        expect(config.title).to.equal("fastapi-packages-test");
        expect(config.type).to.equal("python-fastapi");
        return tomlFiles;
      },
    );

    // Verify the Python Packages section exists
    cy.findInPublisherWebview('[data-automation="python-packages"]').should(
      "exist",
    );

    // Verify fastapi appears in the package list
    cy.findInPublisherWebview('[data-automation="python-packages"]').should(
      "contain.text",
      "fastapi",
    );
  });
});
