// Copyright (C) 2025 by Posit Software, PBC.

const WORKBENCH_BASE_URL = Cypress.env("WORKBENCH_URL");

describe("Workbench > Positron", { baseUrl: WORKBENCH_BASE_URL }, () => {
  before(() => {
    cy.resetConnect();
    cy.setAdminCredentials();
  });

  beforeEach(() => {
    cy.clearupDeployments();
    // Reset and restart the Workbench container before each test to ensure a clean state
    cy.restartWorkbench();
    cy.checkPositronExtension();
    cy.visitAndLoginToWorkbench();
    cy.startPositronSession();
  });

  context("Connect", () => {
    it("Static Content Deployment", () => {
      cy.createPWBDeployment(
        "static",
        "index.html",
        "static",
        (tomlFiles) => {
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
        },
        "Connect",
      ).deployCurrentlySelected();
    });

    // TODO this passes but has errors in the console:
    // Error in file(filename, "r", encoding = encoding) :
    //   cannot open the connection
    // In addition: Warning message:
    // In file(filename, "r", encoding = encoding) :
    //   cannot open file 'renv/activate.R': No such file or directory
    // Error while sourcing R profile file at path '/content-workspace/shinyapp/.Rprofile':
    // Unexpected longjump
    // Likely caused by:
    // Error in file(filename, "r", encoding = encoding) :
    //   cannot open the connection
    it.skip("ShinyApp Content Deployment", () => {
      cy.createPWBDeployment("shinyapp", "app.R", "ShinyApp", (tomlFiles) => {
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
});
