// OAuth Device Flow Task - Automates OAuth completion for VS Code extension and supports programmatic device workflow

const axios = require("axios");
const { getPlaywrightTimeout } = require("./playwright-utils");
const {
  getSharedBrowserContext,
  cleanupSharedBrowser,
} = require("./shared-browser");

/**
 * Automates the OAuth device code flow in a browser using Playwright.
 * Navigates to the verification URL, logs in with the provided credentials,
 * and completes the device authorization.
 */
async function authorizeDeviceWithBrowser(verificationUrl, email, password) {
  let page;
  try {
    console.log(`🚀 Starting OAuth automation for: ${email}`);
    console.log(`🔗 Verification URL: ${verificationUrl}`);

    // Use fresh browser context for OAuth to avoid state issues
    const { context } = await getSharedBrowserContext(true);
    page = await context.newPage();

    // Block Google analytics and tracking requests to improve speed and reliability
    await page.route("**/*google-analytics.com*", (route) => route.abort());
    await page.route("**/*googletagmanager.com*", (route) => route.abort());
    await page.route("**/*android.clients.google.com*", (route) =>
      route.abort(),
    );

    // Capture browser console logs only in debug mode
    if (process.env.DEBUG_PLAYWRIGHT === "true") {
      page.on("console", (msg) => {
        console.log(`🌐 Browser console [${msg.type()}]:`, msg.text());
      });
    }

    console.log(`📖 Navigating to OAuth page...`);
    await page.goto(verificationUrl);
    await page.waitForLoadState("networkidle");

    console.log(`✉️ Filling email field with: ${email}`);
    // Fill email field
    const emailSelectors = [
      'input[name="email"]',
      'input[type="email"]',
      'input[id*="email"]',
      'input[placeholder*="email" i]',
    ];
    let emailField = null;
    for (const selector of emailSelectors) {
      try {
        await page.waitForSelector(selector, {
          timeout: getPlaywrightTimeout(),
        });
        emailField = selector;
        break;
      } catch {
        /* ignore */
      }
    }
    if (!emailField) throw new Error("Could not find email input field");
    await page.fill(emailField, email);
    console.log(`📤 Email filled successfully`);

    // Click continue button
    console.log(`🔘 Looking for continue button...`);
    const continueSelectors = [
      'button:has-text("Continue")',
      'button[type="submit"]',
      'input[type="submit"]',
    ];
    let continueButton = null;
    for (const selector of continueSelectors) {
      try {
        await page.waitForSelector(selector, {
          timeout: getPlaywrightTimeout(),
        });
        continueButton = selector;
        break;
      } catch {
        /* ignore */
      }
    }
    if (!continueButton) {
      await page.keyboard.press("Enter");
    } else {
      await page.click(continueButton);
    }
    console.log(`🔑 Looking for password field...`);
    // Fill password field
    const passwordSelectors = [
      'input[name="password"]',
      'input[type="password"]',
      'input[id*="password"]',
    ];
    let passwordField = null;
    for (const selector of passwordSelectors) {
      try {
        await page.waitForSelector(selector, {
          timeout: getPlaywrightTimeout(),
        });
        passwordField = selector;
        break;
      } catch {
        /* ignore */
      }
    }
    if (!passwordField) throw new Error("Could not find password input field");
    await page.fill(passwordField, password);
    console.log(`🔑 Password filled successfully`);

    console.log(`🔘 Looking for login button...`);
    // Click login button
    const loginSelectors = [
      'button:has-text("Log in")',
      'button:has-text("Sign in")',
      'button[type="submit"]',
      'input[type="submit"]',
    ];
    let loginButton = null;
    for (const selector of loginSelectors) {
      try {
        await page.waitForSelector(selector, {
          timeout: getPlaywrightTimeout(),
        });
        loginButton = selector;
        break;
      } catch {
        /* ignore */
      }
    }
    if (!loginButton) {
      await page.keyboard.press("Enter");
    } else {
      await page.click(loginButton);
    }
    console.log(`🔐 Handling authorization page...`);
    // Handle authorization page
    await page.waitForSelector("text=Authorize access", {
      timeout: getPlaywrightTimeout(),
    });
    console.log(`✅ Found authorization page, clicking Continue...`);
    await page.click('button:has-text("Continue")');
    console.log(`✅ Clicking Authorize...`);
    await page.click('button:has-text("Authorize")');
    console.log(`⏳ Waiting for success confirmation...`);
    // Wait for success
    await page.waitForSelector("text=Access authorized", {
      timeout: getPlaywrightTimeout(),
    });
    console.log(`🎉 OAuth authorization completed successfully!`);
  } finally {
    try {
      // Only close the page, not the shared browser/context
      if (page) await page.close();
    } catch (cleanupErr) {
      console.log("[Playwright] Page cleanup error:", cleanupErr.message);
    }
  }
}

/**
 * Completes the OAuth device flow for a given user and OAuth URL.
 * Used for positive-path automation (successfully authenticates).
 * Returns a result object indicating success or mock tokens for fallback.
 */
async function authenticateOAuthDevice(credentials) {
  const { email, password, oauthUrl } = credentials;
  try {
    const urlParams = new URLSearchParams(oauthUrl.split("?")[1]);
    const userCode = urlParams.get("user_code");
    if (!userCode) {
      throw new Error(
        "Could not extract user_code from OAuth URL: " + oauthUrl,
      );
    }
    await authorizeDeviceWithBrowser(oauthUrl, email, password);
    return {
      success: true,
      message: "OAuth completed - VS Code should detect completion",
      userCode: userCode,
      completed: true,
    };
  } catch {
    return {
      access_token: "mock-access-token-for-testing",
      refresh_token: "mock-refresh-token-for-testing",
      user: { email: email },
      expires_in: 3600,
      _mock: true,
    };
  }
}

/**
 * Runs the full device workflow programmatically (API + browser).
 * 1. Requests a device code from the OAuth server.
 * 2. Polls for the token (should be pending).
 * 3. Automates browser login and device authorization.
 * 4. Polls for the access token and returns it.
 */
async function runDeviceWorkflow({ email, password, env = "staging" }) {
  try {
    // Use login.<env>.posit.cloud for device code and token endpoints
    const deviceCodeUrl = `https://login.${env}.posit.cloud/oauth/device/authorize?client_id=posit-publisher-${env}&scope=vivid`;
    const tokenUrl = `https://login.${env}.posit.cloud/oauth/token`;
    // Step 1: Get device code
    const deviceResponse = await axios.post(deviceCodeUrl, null, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      maxRedirects: 0,
      validateStatus: () => true,
    });
    if (deviceResponse.status !== 200) {
      return {
        success: false,
        error: `Failed to get device code: ${deviceResponse.status} ${JSON.stringify(deviceResponse.data)}`,
      };
    }
    const device_code = deviceResponse.data.device_code;
    const verification_url = deviceResponse.data.verification_uri_complete;
    // Step 2: Poll for token (should fail with authorization_pending)
    const pollToken = async () => {
      const data = {
        client_id: `posit-publisher-${env}`,
        device_code,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        scope: "vivid",
      };
      const response = await axios.post(tokenUrl, data, {
        headers: { "Content-Type": "application/json" },
        maxRedirects: 0,
        validateStatus: () => true,
      });
      return response;
    };
    const authResponse = await pollToken(400);
    if (authResponse.data.error !== "authorization_pending") {
      return {
        success: false,
        error: `Unexpected error before authorization: ${JSON.stringify(authResponse.data)}`,
      };
    }
    // Step 3: Authorize device using browser automation
    await authorizeDeviceWithBrowser(verification_url, email, password);
    // Step 4: Poll for access token (with retries)
    const maxRetries = 10;
    const retryInterval = 2000;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const tokenResponse = await pollToken(200);
      if (tokenResponse.status === 200 && tokenResponse.data.access_token) {
        return {
          success: true,
          access_token: tokenResponse.data.access_token,
          refresh_token: tokenResponse.data.refresh_token,
          expires_in: tokenResponse.data.expires_in,
          token_type: tokenResponse.data.token_type,
          scope: tokenResponse.data.scope,
        };
      }
      await new Promise((res) => setTimeout(res, retryInterval));
    }
    return { success: false, error: "Timed out waiting for access token" };
  } catch (err) {
    console.error("runDeviceWorkflow error:", err);
    return { success: false, error: err.message || String(err) };
  }
  // No cleanup needed - shared browser handles its own lifecycle
}

/**
 * Closes any open OAuth window in the shared Playwright browser context.
 * Used to simulate user cancellation of the OAuth flow.
 */
async function closeOAuthWindow() {
  try {
    console.log(`🚪 Closing OAuth window without completing authentication...`);

    const { context } = await getSharedBrowserContext(false);
    const pages = context.pages();

    // Find the OAuth page
    const oauthPage = pages.find((page) =>
      page.url().includes("login.staging.posit.cloud/oauth/device"),
    );

    if (oauthPage) {
      await oauthPage.close();
      console.log(`✅ OAuth window closed without completing authentication`);
      return { success: true, message: "OAuth window closed" };
    } else {
      console.log(`⚠️ No OAuth window found to close`);
      return { success: false, message: "No OAuth window found" };
    }
  } catch (error) {
    console.error(`❌ Error closing OAuth window:`, error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  authenticateOAuthDevice,
  runDeviceWorkflow,
  closeOAuthWindow,
  cleanupSharedBrowser,
};

// Clean up shared browser on process exit
process.on("exit", cleanupSharedBrowser);
process.on("SIGINT", cleanupSharedBrowser);
process.on("SIGTERM", cleanupSharedBrowser);
