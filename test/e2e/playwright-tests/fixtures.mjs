import { test as base, expect } from "@playwright/test";
import * as fs from "fs";

/**
 * Custom fixtures for Publisher E2E tests.
 *
 * This provides the same functionality as Cypress custom commands,
 * but using Playwright's fixture pattern which enables:
 * - Better TypeScript support
 * - Automatic cleanup
 * - Parallel test isolation
 */

/**
 * Wait for the Publisher extension iframe to be ready and return a FrameLocator.
 * This is equivalent to cy.publisherWebview()
 */
async function getPublisherWebview(page) {
  // Wait for the outer webview iframe
  const outerFrame = page.frameLocator(
    'iframe.webview.ready[src*="posit.publisher"]',
  );

  // Wait for it to be attached
  await expect(outerFrame.locator("body")).toBeAttached({ timeout: 60000 });

  // Get the inner active-frame
  const innerFrame = outerFrame.frameLocator("#active-frame");

  // Wait for the inner frame content
  await expect(innerFrame.locator("#app")).toBeAttached({ timeout: 30000 });

  return innerFrame;
}

/**
 * Find and click the Publisher sidebar icon.
 * Equivalent to cy.getPublisherSidebarIcon().click()
 */
async function clickPublisherSidebarIcon(page) {
  const selectors = [
    'button[aria-label*="Posit Publisher"]',
    'button[title*="Posit Publisher"]',
    'button[aria-label*="Publisher"]',
    ".codicon-posit-publisher-publish",
  ];

  for (const selector of selectors) {
    const button = page.locator(selector).first();
    if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
      await button.click();
      return;
    }
  }

  throw new Error("Publisher sidebar icon not found");
}

// Extend the base test with our custom fixtures
export const test = base.extend({
  // API key from environment
  connectApiKey: async ({}, use) => {
    const key = process.env.CYPRESS_BOOTSTRAP_ADMIN_API_KEY || "";
    await use(key);
  },

  // Publisher webview fixture - automatically waits for iframe
  publisherWebview: async ({ page }, use) => {
    const webview = await getPublisherWebview(page);
    await use(webview);
  },

  // Reset credentials to empty state
  resetCredentials: async ({}, use) => {
    const reset = async () => {
      fs.writeFileSync(
        "e2e-test.connect-credentials",
        "# File updated and managed by e2e tests.\n\n",
      );
    };
    await use(reset);
  },

  // Set dummy credentials for testing
  setDummyCredentials: async ({}, use) => {
    const setDummy = async () => {
      const content = `[credentials]
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
`;
      fs.writeFileSync("e2e-test.connect-credentials", content);
    };
    await use(setDummy);
  },

  // Open the Publisher sidebar
  openPublisherSidebar: async ({ page }, use) => {
    const open = async () => {
      await clickPublisherSidebarIcon(page);
      // Wait for webview to be ready
      await getPublisherWebview(page);
    };
    await use(open);
  },

  // Toggle credentials section
  toggleCredentialsSection: async ({ page }, use) => {
    const toggle = async () => {
      const webview = await getPublisherWebview(page);
      const section = webview.locator(
        '[data-automation="publisher-credentials-section"]',
      );
      await section.locator(".title").click();
    };
    await use(toggle);
  },

  // Refresh credentials
  refreshCredentials: async ({ page }, use) => {
    const refresh = async () => {
      const webview = await getPublisherWebview(page);
      const section = webview.locator(
        '[data-automation="publisher-credentials-section"]',
      );
      await section.hover();
      await section.locator('a[aria-label="Refresh Credentials"]').click();
      // Wait for network to settle
      await page.waitForLoadState("networkidle");
    };
    await use(refresh);
  },

  // Start credential creation flow
  startCredentialCreationFlow: async ({ page }, use) => {
    const start = async (platform) => {
      const webview = await getPublisherWebview(page);

      // Click "New Credential" action
      const section = webview.locator(
        '[data-automation="publisher-credentials-section"]',
      );
      await section.locator(".pane-header").focus();
      await section.locator('[aria-label="New Credential"]').click();

      // Wait for quick input
      await expect(page.locator(".quick-input-widget")).toBeVisible();

      // Select platform
      const platformLabel =
        platform === "server" ? "Posit Connect Server" : "Posit Connect Cloud";
      await page
        .locator(".quick-input-list-row")
        .filter({ hasText: platformLabel })
        .click();
    };
    await use(start);
  },
});

export { expect };
