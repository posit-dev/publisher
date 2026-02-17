// Copyright (C) 2025 by Posit Software, PBC.

/**
 * Credentials Section Tests - Playwright Version
 *
 * This is a migration of test/e2e/tests/credentials.cy.js to Playwright.
 *
 * Key differences from Cypress:
 * - async/await instead of command chaining
 * - Fixtures instead of custom commands
 * - Built-in parallel execution
 * - No need for cy.wrap() or special iframe handling
 */

import { test, expect } from "./fixtures.mjs";

test.describe("Credentials Section", () => {
  test.beforeEach(async ({ page, resetCredentials, openPublisherSidebar }) => {
    // Reset credentials for clean slate
    await resetCredentials();

    // Navigate and open Publisher sidebar
    await page.goto("/");
    await openPublisherSidebar();
  });

  test("New PCS Credential", async ({
    page,
    publisherWebview,
    connectApiKey,
    startCredentialCreationFlow,
    toggleCredentialsSection,
    refreshCredentials,
  }) => {
    // Ensure the credentials section is expanded and empty
    await toggleCredentialsSection();
    await refreshCredentials();
    await expect(
      publisherWebview.getByText("No credentials have been added yet."),
    ).toBeVisible();

    // Start the flow and select the 'server' platform
    await startCredentialCreationFlow("server");

    // Enter server URL
    await expect(page.locator(".quick-input-message")).toContainText(
      "Please provide the Posit Connect server's URL",
    );
    await page
      .locator(".quick-input-widget input")
      .fill("http://connect-publisher-e2e:3939");
    await page.keyboard.press("Enter");

    // Select API key authentication
    await expect(
      page.locator(".quick-input-and-message input"),
    ).toHaveAttribute("placeholder", "Select authentication method");
    await page.locator(".quick-input-list .monaco-list-row").nth(1).click();

    // Enter API key
    await expect(page.locator(".quick-input-message")).toContainText(
      "The API key to be used to authenticate with Posit Connect.",
    );
    await page.locator(".quick-input-widget input").fill(connectApiKey);
    await page.keyboard.press("Enter");

    // Wait for success message
    await expect(page.locator(".quick-input-message")).toContainText(
      "Successfully connected to http://connect-publisher-e2e:3939 🎉",
      { timeout: 15000 },
    );

    // Enter nickname
    await expect(page.locator(".quick-input-message")).toContainText(
      "Enter a unique nickname for this server.",
    );
    await page.locator(".quick-input-widget input").fill("admin-code-server");
    await page.keyboard.press("Enter");

    // Verify credential appears in the list
    const credentialItem = publisherWebview.locator(
      '[data-automation="admin-code-server-list"]',
    );
    await expect(credentialItem.locator(".tree-item-title")).toHaveText(
      "admin-code-server",
    );
  });

  test("Existing Credentials Load", async ({
    publisherWebview,
    setDummyCredentials,
    toggleCredentialsSection,
    refreshCredentials,
  }) => {
    // Seed two dummy credentials
    await setDummyCredentials();
    await toggleCredentialsSection();
    await refreshCredentials();

    // Verify empty state is NOT shown
    await expect(
      publisherWebview.getByText("No credentials have been added yet."),
    ).not.toBeVisible();

    // Verify both credentials are displayed
    const credOne = publisherWebview.locator(
      '[data-automation="dummy-credential-one-list"]',
    );
    await expect(credOne.locator(".tree-item-title")).toHaveText(
      "dummy-credential-one",
    );

    const credTwo = publisherWebview.locator(
      '[data-automation="dummy-credential-two-list"]',
    );
    await expect(credTwo.locator(".tree-item-title")).toHaveText(
      "dummy-credential-two",
    );
  });

  test("Delete Credential", async ({
    page,
    publisherWebview,
    setDummyCredentials,
    toggleCredentialsSection,
    refreshCredentials,
  }) => {
    // Seed credentials
    await setDummyCredentials();
    await toggleCredentialsSection();
    await refreshCredentials();

    // Hover over credential to reveal delete button
    const credRecord = publisherWebview.locator(
      '[data-automation="dummy-credential-one-list"]',
    );
    await credRecord.hover();

    // Click delete button
    await credRecord.locator('[aria-label="Delete Credential"]').click();

    // Confirm deletion in dialog
    await page.locator(".dialog-buttons").getByText("Delete").click();

    // Verify credential is removed
    await expect(
      publisherWebview.locator('[data-automation="dummy-credential-one-list"]'),
    ).not.toBeVisible();
  });

  // PCC OAuth test would require additional setup with Playwright browser automation
  // Similar to the Cypress task('authenticateOAuthDevice') but using Playwright's
  // native browser context instead
  test.skip("New PCC Credential - OAuth Device Code @pcc", async () => {
    // This test requires OAuth flow automation
    // Would be implemented using Playwright's browser context
  });
});
