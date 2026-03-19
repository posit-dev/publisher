// Copyright (C) 2025 by Posit Software, PBC.

import "@testing-library/cypress/add-commands";
import "cypress-wait-until";
import "cypress-network-idle";
import { parse } from "smol-toml";
import "./selectors";
import "./sequences";
import "./workbench";

// initializeConnect: Simple initialization for use with with-connect action
// The API key is passed via CYPRESS_BOOTSTRAP_ADMIN_API_KEY environment variable
// from the with-connect GitHub Action, which handles Connect startup and bootstrapping.
Cypress.Commands.add("initializeConnect", () => {
  cy.clearupDeployments();
  cy.visit("/");
  cy.getPublisherSidebarIcon().click();
  cy.waitForPublisherIframe();
  cy.debugIframes();
  cy.resetCredentials();
  cy.setAdminCredentials();
});

// getConnectVersion
// Purpose: Fetch the Connect server version from the server_settings API.
// Returns: A promise that resolves with the version string (e.g., "2025.03.0")
Cypress.Commands.add("getConnectVersion", () => {
  const connectUrl =
    Cypress.env("CONNECT_SERVER_URL") || "http://localhost:3939";
  const apiKey = Cypress.env("BOOTSTRAP_ADMIN_API_KEY");

  return cy
    .request({
      method: "GET",
      url: `${connectUrl}/__api__/server_settings`,
      headers: {
        Authorization: `Key ${apiKey}`,
      },
      failOnStatusCode: false,
    })
    .then((response) => {
      if (response.status === 200 && response.body.version) {
        return response.body.version;
      }
      throw new Error(
        `Failed to get Connect version: status=${response.status}`,
      );
    });
});

// isConnectVersionBefore
// Purpose: Check if the current Connect server version is before a given version.
// Parameters:
//   - targetVersion: Version string to compare against (e.g., "2025.03" or "2025.03.0")
// Returns: A promise that resolves with true if Connect version < targetVersion
Cypress.Commands.add("isConnectVersionBefore", (targetVersion) => {
  return cy.getConnectVersion().then((currentVersion) => {
    // Parse versions into comparable parts (e.g., "2025.03.0" -> [2025, 3, 0])
    const parseParts = (v) =>
      v.split(".").map((p) => parseInt(p.replace(/^0+/, "") || "0", 10));
    const current = parseParts(currentVersion);
    const target = parseParts(targetVersion);

    // Compare version parts
    for (let i = 0; i < Math.max(current.length, target.length); i++) {
      const c = current[i] || 0;
      const t = target[i] || 0;
      if (c < t) return true;
      if (c > t) return false;
    }
    return false; // versions are equal
  });
});

// skipIfConnectVersionBefore
// Purpose: Skip the current test if Connect version is before the specified version.
// Parameters:
//   - targetVersion: Version string to compare against (e.g., "2025.03")
//   - reason: Optional reason for skipping (displayed in test output)
Cypress.Commands.add("skipIfConnectVersionBefore", (targetVersion, reason) => {
  return cy.isConnectVersionBefore(targetVersion).then((isBefore) => {
    if (isBefore) {
      const message = reason || `Skipping: Connect version < ${targetVersion}`;
      cy.log(message);
      // Use Cypress's built-in skip by throwing a special error
      // that Mocha recognizes as a skip
      const test = cy.state("runnable");
      if (test) {
        test.skip();
      }
    }
  });
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

    // Clean up Playwright browser after each test
    cy.task("cleanupPlaywrightBrowser", null, { timeout: 20000 });
  });
}

// resetCredentials
// Purpose: Delete all credentials via UI by looping over each credential item.
// Requires UI to be loaded (page visited, sidebar open, iframe ready).
Cypress.Commands.add("resetCredentials", () => {
  cy.toggleCredentialsSection();

  function deleteNextCredential() {
    cy.publisherWebview()
      .findByTestId("publisher-credentials-section")
      .then(($section) => {
        const $sec = Cypress.$($section);
        // Check for empty state
        if (
          $sec
            .find(':contains("No credentials have been added yet.")')
            .filter(":visible").length > 0
        ) {
          cy.log("All credentials deleted (section is empty)");
          return;
        }

        // Find the first credential item
        const $items = $sec.find(".tree-item");
        if ($items.length === 0) {
          cy.log("No credential items found, done");
          return;
        }

        // Hover over the first item and click delete
        cy.wrap($items.first()).should("be.visible").trigger("mouseover");
        cy.wrap($items.first())
          .find('[aria-label="Delete Credential"]')
          .click({ force: true });

        // Confirm deletion in the dialog
        cy.get(".dialog-buttons")
          .findByText("Delete")
          .should("be.visible")
          .click();

        // Wait for UI to update, then try deleting next
        cy.refreshCredentials();
        deleteNextCredential();
      });
  }

  deleteNextCredential();
});

// setAdminCredentials
// Purpose: Create the admin PCS credential via the UI credential creation flow.
// Requires UI to be loaded (page visited, sidebar open, iframe ready).
Cypress.Commands.add("setAdminCredentials", () => {
  if (!Cypress.env("BOOTSTRAP_ADMIN_API_KEY")) {
    throw new Error(
      "Cypress env BOOTSTRAP_ADMIN_API_KEY is empty. Cannot set admin credentials.",
    );
  }

  cy.toggleCredentialsSection();
  cy.clickSectionAction("New Credential");
  cy.get(".quick-input-widget").should("be.visible");

  cy.get(".quick-input-titlebar")
    .should("have.text", "Create a New Credential")
    .click();

  // Select "server" platform
  cy.get(".quick-input-list-row").contains("server").click();

  // Enter server URL
  cy.get(".quick-input-message").should(
    "include.text",
    "Please provide the Posit Connect server's URL",
  );
  cy.get(".quick-input-widget").type(
    "http://connect-publisher-e2e:3939{enter}",
  );

  // Select API key auth method (second row)
  cy.get(".quick-input-and-message input").should(
    "have.attr",
    "placeholder",
    "Select authentication method",
  );
  cy.get(".quick-input-list .monaco-list-row").eq(1).click();

  // Enter API key
  cy.get(".quick-input-message").should(
    "include.text",
    "The API key to be used to authenticate with Posit Connect.",
  );
  cy.get(".quick-input-widget").type(
    `${Cypress.env("BOOTSTRAP_ADMIN_API_KEY")}{enter}`,
  );

  // Wait for successful connection
  cy.get(".quick-input-message", { timeout: 15000 }).should(
    "include.text",
    "Successfully connected to http://connect-publisher-e2e:3939",
  );

  // Enter nickname
  cy.get(".quick-input-widget").type("admin-code-server{enter}");

  // Verify credential appears
  cy.findInPublisherWebview('[data-automation="admin-code-server-list"]')
    .find(".tree-item-title")
    .should("have.text", "admin-code-server");
});

// clearupDeployments
// Purpose: Remove .posit metadata to reset deployments per test or per subdir, with exclusions.
Cypress.Commands.add(
  "clearupDeployments",
  (subdir, excludeDirs = ["config-errors"]) => {
    // If subdir is provided, only target that directory
    if (subdir) {
      // If subdir is in the exclude list, skip deletion
      if (excludeDirs.includes(subdir)) return;
      const target = `content-workspace/${subdir}/.posit`;
      cy.exec(`rm -rf ${target}`, { failOnNonZeroExit: false });
    } else {
      // Build a list of all .posit directories except excluded ones
      const excludePatterns = excludeDirs
        .map((dir) => `-not -path "*/${dir}/*"`)
        .join(" ");
      const findCmd = `find content-workspace -type d -name ".posit" ${excludePatterns}`;
      cy.exec(`${findCmd} -exec rm -rf {} +`, { failOnNonZeroExit: false });
    }
  },
);

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
    if (result.exitCode === 0 && result.stdout) {
      return result.stdout.trim();
    }
    throw new Error(`Could not expandWildcardFile. ${result.stderr}`);
  });
});

// savePublisherFile
// Purpose: Mutate a Publisher TOML (e.g., set connect_cloud.access_control.public_access).
// - Container-safe: reads and writes via docker exec to avoid CI permissions issues.
// When to use: After createPCCDeployment but before deploy.
Cypress.Commands.add("savePublisherFile", (filePath, jsonObject) => {
  // Map host path to container path
  const dockerPath = filePath.replace(
    "content-workspace/",
    "/home/coder/workspace/",
  );

  // Read the file content from inside the container
  return cy
    .exec(
      `docker exec publisher-e2e.code-server bash -c "cat '${dockerPath}'"`,
      { failOnNonZeroExit: false },
    )
    .then((readResult) => {
      if (readResult.code !== 0 || !readResult.stdout) {
        throw new Error(
          `Failed to read TOML via Docker: ${readResult.stderr || "no stdout"}`,
        );
      }

      let modifiedContent = readResult.stdout;

      // Minimal mutation support for connect_cloud.access_control.public_access
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

      // Overwrite the file inside the container
      const escaped = modifiedContent
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "'\"'\"'");
      return cy.exec(
        `docker exec publisher-e2e.code-server bash -c "cat <<'EOF' > '${dockerPath}'\n${escaped}\nEOF"`,
      );
    });
});

// loadTomlFile
// Purpose: Read and parse TOML into JSON for assertions.
Cypress.Commands.add("loadTomlFile", (filePath) => {
  return cy
    .exec(`cat ${filePath}`, { failOnNonZeroExit: false })
    .then((result) => {
      if (result.exitCode === 0 && result.stdout) {
        return parse(result.stdout);
      }
      throw new Error(`Could not load project configuration. ${result.stderr}`);
    });
});

// runCommandPaletteCommand
// Purpose: Invoke a command by label through the VS Code command palette.
Cypress.Commands.add("runCommandPaletteCommand", (commandLabel) => {
  cy.retryWithBackoff(
    () =>
      cy
        .get("body")
        .then(($body) => {
          if ($body.find(".quick-input-widget:visible").length > 0) {
            return;
          }
          if ($body.find(".command-center-center").length > 0) {
            $body.find(".command-center-center").get(0).click();
            return;
          }
          if ($body.find('[aria-label="Application Menu"]').length > 0) {
            $body.find('[aria-label="Application Menu"]').get(0).click();
            cy.contains(".monaco-menu", "Command Palette").click({
              force: true,
            });
            return;
          }
          if ($body.find('[aria-label="Menu"]').length > 0) {
            $body.find('[aria-label="Menu"]').get(0).click();
            cy.contains(".monaco-menu", "Command Palette").click({
              force: true,
            });
          }
        })
        .then(() => cy.get(".quick-input-widget:visible")),
    8,
    750,
  ).should("be.visible");
  cy.get(".quick-input-widget input").clear();
  cy.get(".quick-input-widget input").type(`> ${commandLabel}`);
  cy.get(".quick-input-list-row").then(($rows) => {
    const fallbackLabel = commandLabel.includes(":")
      ? commandLabel.split(":").slice(1).join(":").trim()
      : commandLabel;
    const match =
      $rows.toArray().find((row) => row.textContent?.includes(commandLabel)) ||
      $rows.toArray().find((row) => row.textContent?.includes(fallbackLabel));
    if (!match) {
      throw new Error(
        `Command not found in palette: "${commandLabel}" (fallback "${fallbackLabel}")`,
      );
    }
    cy.wrap(Cypress.$(match)).should("be.visible").click();
  });
});

// quickInputType
// Purpose: Fill a quick input prompt and submit the value.
Cypress.Commands.add("quickInputType", (promptText, value) => {
  cy.get(".quick-input-message").should("contain.text", promptText);
  cy.get(".quick-input-widget input").clear();
  cy.get(".quick-input-widget input").type(`${value}{enter}`);
});

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
        // Wait for network to settle after iframe is found
        cy.waitForNetworkIdle(500);
        return cy.wrap($publisherIframe[0]);
      }
      // Fallback: use the first .webview.ready iframe
      cy.log("Falling back to first .webview.ready iframe");
      cy.waitForNetworkIdle(500);
      return cy.wrap($iframes[0]);
    });
});

// Debug: Waits for all iframes to exist (helps with timing issues in CI).
// If DEBUG_CYPRESS is "true", also logs iframe attributes for debugging.
Cypress.Commands.add("debugIframes", () => {
  if (Cypress.env("DEBUG_CYPRESS") !== "true") return;
  // Simplified logging - less verbose
  cy.get("iframe", { timeout: 30000 }).then(($iframes) => {
    cy.task("print", `Found ${$iframes.length} iframes total`);
    $iframes.each((idx, el) => {
      const src = el.src || "";
      if (src.includes("posit.publisher") || src.includes("webview")) {
        cy.task(
          "print",
          `iframe[${idx}] src=${src.substring(0, 100)}${src.length > 100 ? "..." : ""}`,
        );
      }
    });
  });
});

// findInPublisherWebview (cached variant)
// Purpose: Cached version for deployments/static tests to speed repeated queries.
// - Skips caching in credential-centric tests where content changes frequently.
Cypress.Commands.add("findInPublisherWebview", (selector) => {
  // Only use caching for tests that don't refresh content
  const testTitle = Cypress.currentTest.title || "";
  // Broaden skip conditions to include OAuth/Negative flows
  const titleIndicatesVolatile = /Credential|Delete|Load|OAuth|Negative/i.test(
    testTitle,
  );

  if (titleIndicatesVolatile) {
    return cy
      .publisherWebview()
      .then((webview) => cy.wrap(webview).find(selector));
  }

  // If volatile UI elements are visible, bypass cache
  return cy.publisherWebview().then((webview) => {
    const $webview = Cypress.$(webview);
    const hasVolatileUI =
      $webview.find(".quick-input-widget:visible, .monaco-dialog-box:visible")
        .length > 0;
    if (hasVolatileUI) {
      return cy.wrap(webview).find(selector);
    }

    // Use caching for stable deployment/static tests
    return cy.window().then((win) => {
      if (!win.cachedPublisherWebview) {
        win.cachedPublisherWebview = cy.publisherWebview();
      }
      return win.cachedPublisherWebview.then((cached) =>
        cy.wrap(cached).find(selector),
      );
    });
  });
});

// retryWithBackoff/findUnique/findUniqueInPublisherWebview
// Purpose: Common primitives to make flaky UI queries reliable and enforce uniqueness.
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
          // Cap max delay at 5 seconds to prevent exponential backoff from causing very long waits
          const delay = Math.min(initialDelay * Math.pow(2, attempt - 1), 5000);
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

    if (count > 1) {
      // Simplified logging for multiple matches
      cy.log(`Found ${count} elements matching selector: "${selector}"`);
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

      if (count > 1) {
        // Simplified logging for multiple matches
        cy.log(
          `Found ${count} elements in webview matching selector: "${selector}"`,
        );
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

// addPCCCredential
// Purpose: Drive the PCC OAuth flow entirely via UI (stubs window.open) and save a nickname.
// When to use: UI-driven PCC credential creation tests.
Cypress.Commands.add(
  "addPCCCredential",
  (
    user,
    nickname = "connect-cloud-credential",
    { assertEmpty = true } = {},
  ) => {
    if (assertEmpty) {
      cy.expectInitialPublisherState();

      cy.toggleCredentialsSection();
      cy.publisherWebview()
        .findByText("No credentials have been added yet.")
        .should("be.visible");
    } else {
      // Just ensure credentials section is expanded
      cy.toggleCredentialsSection();
    }

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

    // Ensure the UI updates: wait for quick-input to close, then refresh credentials
    cy.get(".quick-input-widget").should("not.be.visible");
    cy.refreshCredentials();
  },
);

// writeTomlFile
// Purpose: Append content to a TOML file inside the code-server container (single or batch mode).
// When to use: Tests that need to tweak TOML after create*Deployment (e.g., version, access settings).
Cypress.Commands.add("writeTomlFile", (filePath, tomlContent) => {
  // filePath: relative to project root (e.g. content-workspace/...)
  // tomlContent: string to append (should include section header if needed)
  // Enhanced: Can also accept array of operations for batching

  if (Array.isArray(filePath)) {
    // Batch mode: filePath is actually an array of {path, content} objects
    const operations = filePath;
    const commands = operations
      .map((op) => {
        const dockerPath = op.path.replace(
          "content-workspace/",
          "/home/coder/workspace/",
        );
        const escapedContent = op.content
          .replace(/\\/g, "\\\\")
          .replace(/'/g, "'\"'\"'");
        return `cat <<EOF >> '${dockerPath}'\n${escapedContent}\nEOF`;
      })
      .join(" && ");

    return cy.exec(
      `docker exec publisher-e2e.code-server bash -c "${commands}"`,
    );
  }

  // Original single file mode
  const dockerPath = filePath.replace(
    "content-workspace/",
    "/home/coder/workspace/",
  );
  // Use double quotes for shell, single quotes for TOML if needed
  return cy
    .exec(
      `docker exec publisher-e2e.code-server bash -c "cat <<EOF >> '${dockerPath}'\n${tomlContent}\nEOF"`,
    )
    .then((result) => {
      if (result.exitCode !== 0) {
        throw new Error(
          `Failed to append to TOML via Docker: ${result.stderr}`,
        );
      }
    });
});

// cancelQuickInput/expectPollingDialogGone/expectCredentialsSectionEmpty
// Purpose: Small convenience helpers used in negative and credentials tests.
Cypress.Commands.add("cancelQuickInput", () => {
  cy.get(".quick-input-widget").type("{esc}");
  cy.get(".quick-input-widget").should("not.be.visible");
});

Cypress.Commands.add("expectPollingDialogGone", () => {
  // Simply ensure the quick input widget is not visible - this covers the polling dialog
  cy.get(".quick-input-widget").should("not.be.visible");
});

Cypress.Commands.add("expectCredentialsSectionEmpty", () => {
  // Refresh the credentials section
  cy.refreshCredentials();

  // Now explicitly toggle/expand the credentials section
  cy.toggleCredentialsSection();

  // Check for empty state message
  cy.publisherWebview()
    .findByText("No credentials have been added yet.")
    .should("be.visible");
});

// deletePCCContent
// Purpose: Delete ALL PCC content for the test account to ensure clean state.
// - Requires Cypress.env("PCC_ACCESS_TOKEN") set by setPCCCredential()
// - Requires Cypress.env("PCC_ACCOUNT_ID") set by setPCCCredential()
Cypress.Commands.add("deletePCCContent", () => {
  const token = Cypress.env("PCC_ACCESS_TOKEN");
  const accountId = Cypress.env("PCC_ACCOUNT_ID");
  const env = Cypress.env("CONNECT_CLOUD_ENV") || "staging";

  // Mask token in any logging
  const mask = (t) => (t ? `${t.slice(0, 4)}***${t.slice(-4)}` : "(none)");

  if (!token || !accountId) {
    cy.task(
      "print",
      `[PCC-DELETE] Skipping: accountId=${accountId || "(none)"} token=${mask(token)}`,
    );
    return;
  }

  // List and delete first batch of content for this account
  const limit = 25; // Delete up to 25 items per test run
  const listUrl = `https://api.${env}.connect.posit.cloud/v1/contents?account_id=${accountId}&include_total=true&limit=${limit}&offset=0&state=active`;

  cy.request({
    method: "GET",
    url: listUrl,
    headers: { Authorization: `Bearer ${token}` },
    failOnStatusCode: false,
  }).then((listResp) => {
    if (listResp.status !== 200) {
      cy.task(
        "print",
        `[PCC-DELETE] List failed with status=${listResp.status}`,
      );
      return;
    }

    const responseData = listResp.body;
    const contents = responseData.data || responseData.contents || [];
    const total = responseData.total || 0;

    cy.task(
      "print",
      `[PCC-DELETE] Found ${total} total items, deleting first ${contents.length}`,
    );

    if (contents.length === 0) {
      cy.task("print", `[PCC-DELETE] No content to delete`);
      return;
    }

    // Helper to delete items sequentially
    function deleteItems(items, index = 0, deletedCount = 0) {
      if (index >= items.length) {
        cy.task(
          "print",
          `[PCC-DELETE] Deleted ${deletedCount} of ${items.length} items`,
        );
        return;
      }

      const content = items[index];
      const deleteUrl = `https://api.${env}.connect.posit.cloud/v1/contents/${content.id}`;

      cy.request({
        method: "DELETE",
        url: deleteUrl,
        headers: { Authorization: `Bearer ${token}` },
        failOnStatusCode: false,
      }).then((deleteResp) => {
        const newDeletedCount =
          deleteResp.status === 204 || deleteResp.status === 200
            ? deletedCount + 1
            : deletedCount;

        if (deleteResp.status === 204 || deleteResp.status === 200) {
          cy.task("print", `[PCC-DELETE] ✓ ${content.title || content.id}`);
        } else {
          cy.task(
            "print",
            `[PCC-DELETE] ✗ ${content.title || content.id} status=${deleteResp.status}`,
          );
        }

        // Delete next item
        deleteItems(items, index + 1, newDeletedCount);
      });
    }

    // Start deleting items
    deleteItems(contents);
  });
});

// NOTE: Specific exception handling is done in support/index.js
// Do not add a catch-all here as it masks real errors.
