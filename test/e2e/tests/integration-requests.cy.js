// Purpose: Verify conditional UI: "Integration Requests" pane behavior differs by credential type.
// - Create a PCS deployment and confirm "Integration Requests" IS shown.
// - Create a PCC credential and deployment, confirm "Integration Requests" is NOT shown.
// Rationale: Ensures PCC hides server-only features while PCS shows them.

describe("IntegrationRequests Section", () => {
  before(() => {
    // Set up both credentials once for speed and determinism
    cy.resetConnect();
    cy.resetCredentials();

    cy.visit("/");

    const user = Cypress.env("pccConfig").pcc_user_ccqa3;
    cy.setAdminCredentials();
    cy.setPCCCredential(user, "connect-cloud-deployment-test");
  });

  beforeEach(() => {
    // Light navigation + webview readiness only
    cy.visit("/");
    cy.getPublisherSidebarIcon().click();
    cy.waitForPublisherIframe();
    cy.debugIframes();
  });

  afterEach(() => {
    cy.clearupDeployments("static");
  });

  it("PCS deployment shows Integration Requests Section", () => {
    // Ensure UI is ready
    cy.expectInitialPublisherState();

    // 1) Create a PCS deployment, then assert Integration Requests IS visible
    cy.createPCSDeployment(
      "static",
      "index.html",
      "static-pcs",
      (tomlFiles) => tomlFiles,
    );

    cy.publisherWebview().findByText("Integration Requests").should("exist");
  });

  it("PCC deployment hides Integration Requests Section", () => {
    // Ensure UI is ready
    cy.expectInitialPublisherState();

    // 2) Create a PCC deployment using the PCC credential, then assert Integration Requests is NOT visible
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
