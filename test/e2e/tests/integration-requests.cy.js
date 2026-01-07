// Purpose: Verify conditional UI: "Integration Requests" pane behavior differs by credential type.
// - Create a PCS deployment and confirm "Integration Requests" IS shown.
// - Create a PCC credential and deployment, confirm "Integration Requests" is NOT shown.
// Rationale: Ensures PCC hides server-only features while PCS shows them.

describe("IntegrationRequests Section", () => {
  describe("Connect Server", () => {
    before(() => {
      cy.initializeConnect();
      cy.resetCredentials();
      cy.setAdminCredentials();
    });

    beforeEach(() => {
      cy.visit("/");
      cy.getPublisherSidebarIcon().click();
      cy.waitForPublisherIframe();
      cy.debugIframes();
    });

    afterEach(() => {
      cy.clearupDeployments("static");
    });

    it("PCS deployment shows Integration Requests Section", () => {
      cy.expectInitialPublisherState();

      cy.createPCSDeployment(
        "static",
        "index.html",
        "static-pcs",
        (tomlFiles) => tomlFiles,
      );

      cy.publisherWebview().findByText("Integration Requests").should("exist");
    });
  });

  describe("Connect Cloud", () => {
    it("PCC deployment hides Integration Requests Section @pcc", () => {
      // Setup - moved from before/beforeEach to avoid running when @pcc tests are filtered
      cy.initializeConnect();
      cy.resetCredentials();
      cy.setAdminCredentials();
      cy.visit("/");

      const user = Cypress.env("pccConfig").pcc_user_ccqa3;
      cy.setPCCCredential(user, "connect-cloud-deployment-test");

      cy.visit("/");
      cy.getPublisherSidebarIcon().click();
      cy.waitForPublisherIframe();
      cy.debugIframes();

      cy.expectInitialPublisherState();

      cy.createPCCDeployment(
        "static",
        "index.html",
        "static-pcc",
        (tomlFiles) => tomlFiles,
        [],
        "connect-cloud-deployment-test",
      );

      cy.publisherWebview()
        .findByText("Integration Requests")
        .should("not.exist");
    });
  });
});
