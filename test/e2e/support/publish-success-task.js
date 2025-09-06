const { chromium } = require("playwright");
const { getPlaywrightTimeout } = require("./playwright-utils");

function getPlaywrightHeadless() {
  if (process.env.CI === "true") return true;
  if (process.env.PLAYWRIGHT_HEADLESS === "true") return true;
  if (process.env.PLAYWRIGHT_HEADLESS === "false") return false;
  return false;
}

async function confirmPCCPublishSuccess({ publishedUrl, expectedTitle }) {
  let browser;
  try {
    console.log(
      "Playwright confirmPCCPublishSuccess called with:",
      publishedUrl,
      expectedTitle,
    );
    const isHeadless = getPlaywrightHeadless();
    browser = await chromium.launch({
      headless: isHeadless,
      slowMo: 500,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--window-size=1280,800",
      ],
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    const maxAttempts = 5; // 5 attempts * 2s = 10 seconds max
    const delay = 2000;
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
              await browser.close();
              return { success: true };
            } else if (content.includes(expectedTitle)) {
              await browser.close();
              return {
                success: true,
                warning: `Title '${expectedTitle}' found in page content but not in .navbar-static-top h1`,
              };
            } else {
              lastError = `Expected title '${expectedTitle}' not found in .navbar-static-top h1 (found: '${h1Text}')`;
            }
          }
        } else if (response && response.status() === 404) {
          await browser.close();
          return {
            success: false,
            error: `HTTP 404: Page not found at ${publishedUrl}`,
          };
        } else {
          lastError = `Status: ${response && response.status()}`;
        }
      } catch (err) {
        console.error(`[Playwright] Attempt ${attempt}: Error:`, err);
        lastError = err.message;
      }
      await new Promise((res) => setTimeout(res, delay));
    }
    await browser.close();
    return {
      success: false,
      error: lastError || "Publish confirmation failed",
    };
  } catch (err) {
    if (browser) await browser.close();
    console.error("Playwright task error:", err);
    return { success: false, error: err.message || String(err) };
  }
}

module.exports = { confirmPCCPublishSuccess };
