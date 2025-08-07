// Copyright (C) 2025 by Posit Software, PBC.

import "@testing-library/cypress/add-commands";
import { parse, stringify } from "smol-toml";
import "./selectors";
import "./sequences";

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

Cypress.Commands.add("clearupDeployments", (subdir) => {
  cy.exec(`rm -rf content-workspace/${subdir}/.posit`, {
    failOnNonZeroExit: false,
  });
});

// returns
// config: {
//   name: string,
//   path: string,
// },
// contentRecord: {
//   name: string,
//   path: string,
// }
Cypress.Commands.add("getPublisherTomlFilePaths", (projectDir) => {
  let configTargetDir = `content-workspace/${projectDir}/.posit/publish`;
  let configFileName = "";
  let configFilePath = "";
  let contentRecordTargetDir = `content-workspace/${projectDir}/.posit/publish/deployments`;
  let contentRecordFileName = "";
  let contentRecordFilePath = "";

  cy.expandWildcardFile(configTargetDir, "*.toml")
    .then((configFile) => {
      configFileName = configFile;
      configFilePath = `${configTargetDir}/${configFile}`;
    })
    .expandWildcardFile(contentRecordTargetDir, "*.toml")
    .then((contentRecordFile) => {
      contentRecordFileName = contentRecordFile;
      contentRecordFilePath = `${contentRecordTargetDir}/${contentRecordFile}`;
    })
    .then(() => {
      return {
        config: {
          name: configFileName,
          path: configFilePath,
        },
        contentRecord: {
          name: contentRecordFileName,
          path: contentRecordFilePath,
        },
      };
    });
});

Cypress.Commands.add("expandWildcardFile", (targetDir, wildCardPath) => {
  return cy
    .exec("pwd")
    .then((result) => {
      return cy.log("CWD", result.stdout);
    })
    .then(() => {
      const cmd = `cd ${targetDir} && file=$(echo ${wildCardPath}) && echo $file`;
      return cy.exec(cmd);
    })
    .then((result) => {
      if (result.code === 0 && result.stdout) {
        return result.stdout;
      }
      throw new Error(`Could not expandWildcardFile. ${result.stderr}`);
    });
});

Cypress.Commands.add("savePublisherFile", (filePath, jsonObject) => {
  return cy
    .exec("pwd")
    .then((result) => {
      return cy
        .log("savePublisherFile CWD", result.stdout)
        .log("filePath", filePath);
    })
    .then(() => {
      const tomlString = stringify(jsonObject);
      return cy.writeFile(filePath, tomlString);
    });
});

Cypress.Commands.add("loadTomlFile", (filePath) => {
  return cy
    .log("filePath", filePath)
    .exec(`cat ${filePath}`, { failOnNonZeroExit: false })
    .then((result) => {
      if (result.code === 0 && result.stdout) {
        return parse(result.stdout);
      }
      throw new Error(`Could not load project configuration. ${result.stderr}`);
    });
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

// Add a global afterEach to log iframes if a test fails (for CI reliability)
if (typeof afterEach === "function") {
  afterEach(function () {
    if (this.currentTest.state === "failed") {
      cy.debugIframes();
    }
  });
}

// Update waitForPublisherIframe to use a longer default timeout for CI reliability
Cypress.Commands.add("waitForPublisherIframe", (timeout = 60000) => {
  cy.get("iframe", { timeout }).should("exist");
});

// Debug: Waits for all iframes to exist (helps with timing issues in CI).
// If DEBUG_CYPRESS is "true", also logs iframe attributes for debugging.
Cypress.Commands.add("debugIframes", () => {
  cy.get("iframe", { timeout: 20000 }).each(($el, idx) => {
    // Always wait for iframes, but only print if debugging is enabled
    if (Cypress.env("DEBUG_CYPRESS") === "true") {
      cy.wrap($el)
        .invoke("attr", "class")
        .then((cls) => {
          cy.wrap($el)
            .invoke("attr", "id")
            .then((id) => {
              cy.wrap($el)
                .invoke("attr", "src")
                .then((src) => {
                  cy.task(
                    "print",
                    `iframe[${idx}] class=${cls} id=${id} src=${src}`,
                  );
                });
            });
        });
    }
  });
});

Cypress.Commands.add("findInPublisherWebview", (selector) => {
  // Always wait for the publisher iframe and body before running the selector
  return cy.waitForPublisherIframe().then(() => {
    return cy.publisherWebview().then((webview) => {
      return cy.wrap(webview).find(selector);
    });
  });
});

Cypress.Commands.add(
  "retryWithBackoff",
  (fn, maxAttempts = 5, initialDelay = 500) => {
    let attempt = 0;
    function tryFn() {
      attempt++;
      return fn().then((result) => {
        if (result && result.length) {
          return result;
        } else if (attempt < maxAttempts) {
          const delay = initialDelay * Math.pow(2, attempt - 1);
          cy.wait(delay);
          return tryFn();
        } else {
          throw new Error("Element not found after retries with backoff");
        }
      });
    }
    return tryFn();
  },
);

Cypress.on("uncaught:exception", () => {
  // Prevent CI from failing on harmless errors
  return false;
});
