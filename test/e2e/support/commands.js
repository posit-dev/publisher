// Copyright (C) 2025 by Posit Software, PBC.

import "@testing-library/cypress/add-commands";
import { parse } from "smol-toml";
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

  return cy
    .expandWildcardFile(configTargetDir, "*.toml")
    .then((configFile) => {
      configFileName = configFile;
      configFilePath = `${configTargetDir}/${configFile}`;
      return cy.expandWildcardFile(contentRecordTargetDir, "*.toml");
    })
    .then((contentRecordFile) => {
      contentRecordFileName = contentRecordFile;
      contentRecordFilePath = `${contentRecordTargetDir}/${contentRecordFile}`;
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
  const cmd = `cd ${targetDir} && ls -t ${wildCardPath} | head -1`;
  return cy.exec(cmd).then((result) => {
    if (result.code === 0 && result.stdout) {
      return result.stdout.trim();
    }
    throw new Error(`Could not expandWildcardFile. ${result.stderr}`);
  });
});

Cypress.Commands.add("savePublisherFile", (filePath, jsonObject) => {
  return cy.readFile(filePath, { encoding: "utf8" }).then((originalContent) => {
    let modifiedContent = originalContent;

    if (jsonObject.connect_cloud) {
      const connectCloudSection = "\n[connect_cloud]\n";
      const accessControlSection = `[connect_cloud.access_control]\npublic_access = ${jsonObject.connect_cloud.access_control.public_access}\n`;

      if (!modifiedContent.includes("[connect_cloud]")) {
        modifiedContent =
          modifiedContent.trim() +
          "\n\n" +
          connectCloudSection +
          accessControlSection;
      } else {
        const connectCloudRegex = /\[connect_cloud\][\s\S]*?(?=\n\[|\n\n|$)/;
        modifiedContent = modifiedContent.replace(
          connectCloudRegex,
          connectCloudSection + accessControlSection,
        );
      }
    }

    return cy.writeFile(filePath, modifiedContent);
  });
});

Cypress.Commands.add("loadTomlFile", (filePath) => {
  return cy
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
  /* eslint-disable-next-line mocha/no-top-level-hooks */
  afterEach(function () {
    if (this.currentTest.state === "failed") {
      cy.debugIframes();
      cy.get("body").then(($body) => {
        cy.task("print", $body.html().substring(0, 1000));
      });
    }
  });
}

// Update waitForPublisherIframe to use a longer default timeout for CI reliability
Cypress.Commands.add("waitForPublisherIframe", (timeout = 60000) => {
  return cy
    .get("iframe.webview.ready", { timeout })
    .should("exist")
    .then(($iframes) => {
      // Try to find the publisher iframe by extensionId
      const $publisherIframe = $iframes.filter((i, el) => {
        return el.src && el.src.includes("posit.publisher");
      });
      if ($publisherIframe.length > 0) {
        cy.log("Found publisher iframe by extensionId");
        return cy.wrap($publisherIframe[0]);
      }
      // Fallback: use the first .webview.ready iframe
      cy.log("Falling back to first .webview.ready iframe");
      return cy.wrap($iframes[0]);
    });
});

// Debug: Waits for all iframes to exist (helps with timing issues in CI).
// If DEBUG_CYPRESS is "true", also logs iframe attributes for debugging.
Cypress.Commands.add("debugIframes", () => {
  cy.get("iframe", { timeout: 30000 }).each(($el, idx) => {
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

Cypress.Commands.add("findUnique", (selector, options = {}) => {
  return cy.get("body").then(($body) => {
    const elements = $body.find(selector);
    const count = elements.length;

    cy.log(`Found ${count} elements matching selector: "${selector}"`);

    if (count > 1) {
      // Log details about each matching element
      elements.each((index, el) => {
        const $el = Cypress.$(el);
        cy.log(`Match #${index + 1}:`);
        cy.log(
          `- Text: ${$el.text().substring(0, 50)}${$el.text().length > 50 ? "..." : ""}`,
        );
        cy.log(
          `- HTML: ${$el.prop("outerHTML").substring(0, 100)}${$el.prop("outerHTML").length > 100 ? "..." : ""}`,
        );
      });

      throw new Error(
        `Expected to find exactly 1 element with selector "${selector}", but found ${count} elements`,
      );
    } else if (count === 0) {
      // Let Cypress handle the "not found" timeout
      return cy.get(selector, options);
    }

    // Return the single element
    return cy.wrap(elements);
  });
});

// For webview elements
Cypress.Commands.add(
  "findUniqueInPublisherWebview",
  (selector, options = {}) => {
    return cy.publisherWebview().then(($body) => {
      const elements = $body.find(selector);
      const count = elements.length;

      cy.log(
        `Found ${count} elements in webview matching selector: "${selector}"`,
      );

      if (count > 1) {
        // Log details about each matching element
        elements.each((index, el) => {
          const $el = Cypress.$(el);
          cy.log(`Match #${index + 1}:`);
          cy.log(
            `- Text: ${$el.text().substring(0, 50)}${$el.text().length > 50 ? "..." : ""}`,
          );
          cy.log(
            `- HTML: ${$el.prop("outerHTML").substring(0, 100)}${$el.prop("outerHTML").length > 100 ? "..." : ""}`,
          );
        });

        throw new Error(
          `Expected to find exactly 1 element in webview with selector "${selector}", but found ${count} elements`,
        );
      } else if (count === 0) {
        // Let Cypress handle the "not found" timeout
        return cy.findInPublisherWebview(selector, options);
      }

      // Return the single element
      return cy.wrap(elements);
    });
  },
);

Cypress.Commands.add(
  "addPCCCredential",
  (user, nickname = "connect-cloud-credential") => {
    cy.getPublisherSidebarIcon().should("be.visible").click();

    cy.toggleCredentialsSection();
    cy.publisherWebview()
      .findByText("No credentials have been added yet.")
      .should("be.visible");

    cy.clickSectionAction("New Credential");
    cy.get(".quick-input-widget").should("be.visible");

    cy.get(".quick-input-titlebar")
      .should("have.text", "Create a New Credential")
      .click();

    cy.get(
      'input[aria-label*="Please select the platform for the new credential."]',
    ).should(
      "have.attr",
      "placeholder",
      "Please select the platform for the new credential.",
    );

    cy.get(".quick-input-list-row")
      .contains("Posit Connect Cloud")
      .should("be.visible")
      .click();

    // Wait for the dialog box to appear and be visible
    cy.get(".monaco-dialog-box")
      .should("be.visible")
      .should("have.attr", "aria-modal", "true");

    // Handle the OAuth popup window BEFORE clicking Open
    cy.window().then((win) => {
      cy.stub(win, "open")
        .callsFake((url) => {
          win.oauthUrl = url;
          const mockWindow = {
            closed: false,
            close: function () {
              this.closed = true;
              setTimeout(() => {
                win.dispatchEvent(new Event("focus"));
              }, 100);
            },
            focus: () => {},
            postMessage: () => {},
          };
          win.mockOAuthWindow = mockWindow;
          return mockWindow;
        })
        .as("windowOpen");
    });

    // Click the "Open" button to start the OAuth flow
    cy.get(".monaco-dialog-box .dialog-buttons a.monaco-button")
      .contains("Open")
      .should("be.visible")
      .click();

    // Wait for window.open to be called
    cy.get("@windowOpen").should("have.been.called");

    // Run the OAuth task with VS Code's captured URL and loaded user credentials
    cy.window().then((win) => {
      cy.task(
        "authenticateOAuthDevice",
        {
          email: user.email,
          password: user.auth.password,
          oauthUrl: win.oauthUrl,
        },
        { timeout: 60000 },
      );
    });

    // Wait for OAuth completion and VS Code to detect it
    cy.get(".monaco-dialog-box").should("not.exist", { timeout: 30000 });

    // Wait for the nickname input field to appear
    cy.get(".quick-input-message", { timeout: 15000 }).should(
      "include.text",
      "Enter a unique nickname for this account.",
    );

    // Continue with credential creation after OAuth success
    cy.get(".quick-input-and-message input")
      .should("exist")
      .should("be.visible");

    cy.get(".quick-input-widget").type(`${nickname}{enter}`);
    // No assertion here; do it in the test.
  },
);

Cypress.Commands.add(
  "setPCCCredential",
  (user, nickname = "pcc-credential") => {
    cy.task(
      "runDeviceWorkflow",
      {
        email: user.email,
        password: user.auth.password,
        env: Cypress.env("PCC_ENV") || "staging",
      },
      { timeout: 90000 },
    ).then((oauthResult) => {
      cy.getPublisherSidebarIcon()
        .should("be.visible", { timeout: 15000 })
        .click({ force: true });
      const guid = user.guid || "57413399-c622-4806-806a-2e18cb32d550";
      const version = 3;
      const server_type = "connect_cloud";
      const url =
        Cypress.env("PCC_URL") || "https://staging.connect.posit.cloud";
      const cloud_environment = Cypress.env("PCC_ENV") || "staging";
      const refresh_token = oauthResult.refresh_token;
      const access_token = oauthResult.access_token;
      const account_id = user.account_id;
      const account_name = user.account_name;
      if (!oauthResult || !oauthResult.success) {
        throw new Error(
          `Device OAuth failed: ${oauthResult && oauthResult.error}`,
        );
      }
      if (!refresh_token || !access_token || !account_id || !account_name) {
        throw new Error("Missing required PCC credential fields");
      }
      const toml = `
[credentials.${nickname}]
guid = '${guid}'
version = ${version}
server_type = '${server_type}'
url = '${url}'
account_id = '${account_id}'
account_name = '${account_name}'
refresh_token = '${refresh_token}'
access_token = '${access_token}'
cloud_environment = '${cloud_environment}'
`;
      cy.writeFile("e2e-test.connect-credentials", toml);
    });
  },
);

Cypress.on("uncaught:exception", () => {
  // Prevent CI from failing on harmless errors
  return false;
});
