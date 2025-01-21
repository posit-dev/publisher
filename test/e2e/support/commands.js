import "cypress-iframe";
import "cypress-real-events";
import "@testing-library/cypress/add-commands";
import "./selectors";

const connectManagerServer = Cypress.env("CONNECT_MANAGER_URL");

Cypress.Commands.add("startConnect", () => {
  cy.request({
    method: "POST",
    url: `${connectManagerServer}/connect/start`,
  });

  cy.exec(
    `npx wait-on -c config/waiton.js ${Cypress.env("CONNECT_SERVER_URL")}/__ping__`,
  );
});

Cypress.Commands.add("stopConnect", () => {
  cy.request({
    method: "POST",
    url: `${connectManagerServer}/connect/stop`,
  });
});

// resetConnectData will clear the database and data directory for the Connect server
Cypress.Commands.add("resetConnectData", () => {
  cy.request({
    method: "POST",
    url: `${connectManagerServer}/connect/clear`,
  });
});

// updateConnectSettings will change the Connect server settings and restart the server
Cypress.Commands.add("updateConnectSettings", (settings) => {
  cy.stopConnect();

  cy.request({
    method: "GET",
    url: `${connectManagerServer}/connect/settings`,
  }).then((response) => {
    const { config } = response.body;

    cy.request({
      method: "PATCH",
      url: `${connectManagerServer}/connect/settings`,
      body: {
        config,
        config_blobs: [settings],
      },
    });
  });

  cy.startConnect();
});

// resetConnectSettings will return the Connect settings to the original config
Cypress.Commands.add("resetConnectSettings", () => {
  cy.request({
    method: "GET",
    url: `${connectManagerServer}/connect/settings`,
  }).then((response) => {
    const { config } = response.body;

    cy.request({
      method: "PATCH",
      url: `${connectManagerServer}/connect/settings`,
      body: {
        config: [config[0]],
      },
    });
  });
});

Cypress.Commands.add("bootstrapAdmin", () => {
  cy.exec(
    `rsconnect bootstrap --raw --jwt-keypath ${Cypress.env("BOOTSTRAP_SECRET_KEY")} --server ${Cypress.env("CONNECT_SERVER_URL")}`,
  ).then((apiKey) => {
    if (apiKey && apiKey.stdout) {
      Cypress.env("BOOTSTRAP_ADMIN_API_KEY", apiKey.stdout);
    }
  });
});

Cypress.Commands.add("resetCredentials", () => {
  cy.exec(
    `cat <<EOF > e2e-test.connect-credentials
# File updated and managed by e2e tests. Refrain from updating it manually.

EOF`,
  );
});

Cypress.Commands.add("setAdminCredentials", () => {
  if (Cypress.env("BOOTSTRAP_ADMIN_API_KEY") !== "") {
    cy.exec(
      `cat <<EOF > e2e-test.connect-credentials
[credentials]
[credentials.admin-code-server]
guid = '9ba2033b-f69e-4da8-8c85-48c1f605d433'
version = 0
url = 'http://connect-publisher-e2e:3939'
api_key = '${Cypress.env("BOOTSTRAP_ADMIN_API_KEY")}'

EOF`,
    );
  } else {
    throw new Error(
      "Cypress env BOOTSTRAP_ADMIN_API_KEY is empty. Cannot set admin credentials.",
    );
  }
});

Cypress.Commands.add("setDummyCredentials", () => {
  cy.exec(
    `cat <<EOF > e2e-test.connect-credentials
[credentials]
[credentials.dummy-credential-one]
guid = 'e558636b-069c-46e4-bd2e-4c46be1685af'
version = 0
url = 'http://connect-publisher-e2e:3939'
api_key = 'tYuI742Pax9hVOb9fk2aSbRONkyxQ9yG'

[credentials.dummy-credential-two]
guid = 'f5b7aaee-e35e-4989-a5b0-d8afa467ba25'
version = 0
url = 'http://2.connect-publisher-e2e:3939'
api_key = 'qWeR742Pax9hVOb9fk2aSbRONkyxQ9yG'

EOF`,
  );
});

Cypress.Commands.add("clearupDeployments", () => {
  cy.exec(`rm -rf content-workspace/static/.posit`);
});

// Performs the full set of reset commands we typically use before executing our tests
Cypress.Commands.add("resetConnect", () => {
  cy.clearupDeployments();
  cy.stopConnect();
  cy.resetConnectSettings();
  cy.resetConnectData();
  cy.startConnect();
  cy.bootstrapAdmin();
});
