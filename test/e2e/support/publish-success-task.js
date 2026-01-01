// Purpose: Confirm a PCC deployment is live by loading the published URL with Playwright.
// - Retries navigation, checks for 404 UI, then inspects .navbar-static-top h1 for expected title.
// - Returns { success, warning? } to the Cypress test for assertion/logging.
// Notes: Reuses a shared browser context to speed up repeated checks.
const { getPlaywrightTimeout } = require("./playwright-utils");

// Import shared browser context from shared-browser utility
const { getSharedBrowserContext } = require("./shared-browser");

async function confirmPCCPublishSuccess({ publishedUrl, expectedTitle }) {
  let page;
  try {
    console.log(`🔍 Verifying published app at: ${publishedUrl}`);

    // Use shared browser context for better performance
    const { context } = await getSharedBrowserContext();
    page = await context.newPage();

    // Block Google analytics and tracking requests to improve speed and reliability
    await page.route("**/*google-analytics.com*", (route) => route.abort());
    await page.route("**/*googletagmanager.com*", (route) => route.abort());
    await page.route("**/*android.clients.google.com*", (route) =>
      route.abort(),
    );

    const maxAttempts = 10; // 10 attempts * 5s = 50 seconds max
    const delay = 5000;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(
          `[Playwright] Attempt ${attempt}: Navigating to ${publishedUrl}`,
        );
        const response = await page.goto(publishedUrl, {
          waitUntil: "domcontentloaded",
          timeout: getPlaywrightTimeout(),
        });
        console.log(
          `[Playwright] Attempt ${attempt}: Navigation complete, status: ${response && response.status()}`,
        );
        if (response && response.status() === 200) {
          // Check for 404 UI (only if element exists)
          const notFoundLocator = page.locator(".error_message h1").first();
          let notFoundText = null;
          if ((await notFoundLocator.count()) > 0) {
            notFoundText = await notFoundLocator.textContent();
          }
          if (notFoundText && notFoundText.trim() === "Page Not Found") {
            lastError = "Page Not Found error UI detected";
            console.log(`[Playwright] Attempt ${attempt}: 404 UI detected`);
          } else {
            // Wait for the Shiny app's navbar-brand h1 to appear (up to 10s)
            let h1Text = null;
            try {
              await page.waitForSelector(".navbar-static-top h1", {
                timeout: getPlaywrightTimeout(),
              });
              const h1 = await page.locator(".navbar-static-top h1").first();
              h1Text = await h1.textContent();
            } catch {
              console.log(
                `[Playwright] Attempt ${attempt}: .navbar-static-top h1 not found after wait`,
              );
            }
            const content = await page.content();
            console.log(
              `[Playwright] Attempt ${attempt}: .navbar-static-top h1='${h1Text}', first 500 page content:`,
              content.substring(0, 500),
            );
            if (h1Text && h1Text.trim() === expectedTitle) {
              return { success: true };
            } else if (content.includes(expectedTitle)) {
              return {
                success: true,
                warning: `Title '${expectedTitle}' found in page content but not in .navbar-static-top h1`,
              };
            } else {
              lastError = `Expected title '${expectedTitle}' not found in .navbar-static-top h1 (found: '${h1Text}')`;
            }
          }
        } else if (response && response.status() === 404) {
          // Don't immediately fail on 404 - the content may not have propagated yet
          lastError = `HTTP 404: Page not found at ${publishedUrl}`;
          console.log(
            `[Playwright] Attempt ${attempt}: Got 404, content may not have propagated yet`,
          );
        } else {
          lastError = `Status: ${response && response.status()}`;
        }
      } catch (err) {
        console.error(`[Playwright] Attempt ${attempt}: Error:`, err);
        lastError = err.message;
      }
      await new Promise((res) => setTimeout(res, delay));
    }
    return {
      success: false,
      error: lastError || "Publish confirmation failed",
    };
  } catch (err) {
    console.error("Playwright task error:", err);
    return { success: false, error: err.message || String(err) };
  } finally {
    try {
      if (page) await page.close();
    } catch (cleanupErr) {
      console.log("[Playwright] Cleanup error:", cleanupErr.message);
    }
  }
}

module.exports = { confirmPCCPublishSuccess };
