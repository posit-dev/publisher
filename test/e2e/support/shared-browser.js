// Shared browser context utility for all Playwright tasks

const { chromium } = require("playwright");

// Global browser context cache for reuse within the same test run
let sharedBrowser = null;
let sharedContext = null;

function getPlaywrightHeadless() {
  if (process.env.CI === "true") return true;
  if (process.env.PLAYWRIGHT_HEADLESS === "true") return true;
  if (process.env.PLAYWRIGHT_HEADLESS === "false") return false;
  return false;
}

// Get or create a shared browser context for better performance
async function getSharedBrowserContext(forceRefresh = false) {
  const isCypressHeadless = getPlaywrightHeadless();

  if (!sharedBrowser || !sharedBrowser.isConnected()) {
    console.log("🔧 Creating new shared browser instance...");
    sharedBrowser = await chromium.launch({
      headless: isCypressHeadless,
      slowMo: 0,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--window-size=1280,800",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-web-security",
        "--disable-features=VizDisplayCompositor,TranslateUI",
        "--disable-background-networking",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        "--disable-extensions",
        "--disable-gpu",
        "--disable-ipc-flooding-protection",
        "--disable-hang-monitor",
        "--disable-client-side-phishing-detection",
        "--disable-component-update",
        "--disable-default-apps",
        "--disable-domain-reliability",
        "--disable-sync",
      ],
    });
  }

  if (!sharedContext || sharedContext.isClosed || forceRefresh) {
    if (sharedContext && !sharedContext.isClosed) {
      console.log("🔄 Refreshing shared context for clean state...");
      await sharedContext.close();
    }
    console.log("🔧 Creating new shared context...");
    sharedContext = await sharedBrowser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.51 Safari/537.36",
      ignoreHTTPSErrors: true,
    });
  }

  return { browser: sharedBrowser, context: sharedContext };
}

// Clean up shared browser resources
async function cleanupSharedBrowser() {
  try {
    if (sharedContext && !sharedContext.isClosed) {
      await sharedContext.close();
      sharedContext = null;
    }
    if (sharedBrowser && sharedBrowser.isConnected()) {
      await sharedBrowser.close();
      sharedBrowser = null;
    }
  } catch (cleanupErr) {
    console.log("[Playwright] Shared cleanup error:", cleanupErr.message);
  }
}

// Clean up shared browser on process exit
process.on("exit", cleanupSharedBrowser);
process.on("SIGINT", cleanupSharedBrowser);
process.on("SIGTERM", cleanupSharedBrowser);

module.exports = { getSharedBrowserContext, cleanupSharedBrowser };
