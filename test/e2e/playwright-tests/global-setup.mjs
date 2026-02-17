import { execSync } from "child_process";
import * as fs from "fs";

/**
 * Global setup runs once before all tests.
 * Equivalent to Cypress's before() in support/index.js
 */
async function globalSetup() {
  console.log("🚀 Global setup: Initializing test environment...");

  // Clear deployments
  try {
    execSync(
      'find content-workspace -type d -name ".posit" -not -path "*/config-errors/*" -exec rm -rf {} + 2>/dev/null || true',
      { cwd: process.cwd(), stdio: "pipe" },
    );
    console.log("✓ Cleared deployment metadata");
  } catch {
    // Ignore errors - directories may not exist
  }

  // Set up admin credentials if API key is available
  const apiKey = process.env.CYPRESS_BOOTSTRAP_ADMIN_API_KEY;
  if (apiKey) {
    const credentialsToml = `# File updated and managed by e2e tests.

[credentials.admin-code-server]
guid = '9ba2033b-f69e-4da8-8c85-48c1f605d433'
version = 0
url = 'http://connect-publisher-e2e:3939'
api_key = '${apiKey}'
`;
    fs.writeFileSync("e2e-test.connect-credentials", credentialsToml);
    console.log("✓ Set admin credentials");
  }

  console.log("✓ Global setup complete");
}

export default globalSetup;
