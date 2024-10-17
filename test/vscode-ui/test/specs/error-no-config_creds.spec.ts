import * as helper from "../helpers.ts";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const connectServer = process.env.CONNECT_SERVER;
const apiKey = process.env.CONNECT_API_KEY;
const title = "my fastapi app";

describe("Detect missing config and credentials", () => {
  let workbench: any;
  let input: any;

  before(async () => {
    workbench = await browser.getWorkbench();
    input = await $(".input");
  });

  it("open extension", async () => {
    browser.$("aria/Posit Publisher").waitForExist({ timeout: 30000 });

    // open posit extension
    const extension = await browser.$("aria/Posit Publisher");
    await expect(extension).toExist();
    await extension.click();
  });

  it("Dropdown shows proper error", async () => {
    // only create deployment file
    await helper.createFastAPIDeploymentFile();

    await helper.switchToSubframe();
    const selectButton = (await $('[data-automation="select-deployment"]')).$(
      ".quick-pick-label",
    );
    await expect(selectButton).toHaveText("Select...");
    await selectButton.click();
  });

  it("Dropdown shows error", async () => {
    // switch out of iframe
    await browser.switchToFrame(null);
    // verify Missing config loads in dropdown and select it
    const createMessage =
      'div.monaco-list-row[aria-label*="Unknown Title Due to Missing Config fastapi-simple-VO48"]';
    const element = await browser.$(createMessage);
    await element.click();
  });

  it("Deployment Details shows error message", async () => {
    await helper.switchToSubframe();
    // verify deployment details error message
    const deploymentName = await $('[data-automation="entrypoint-label"]');
    const deploymentDetails = `Unknown Title Due to Missing Config fastapi-simple-VO48\nMissing Credential for https://rsc.radixu.com\nProjectDir and Entrypoint not determined`;
    await expect(deploymentName).toHaveText(deploymentDetails);
  });

  it("Configuration Details shows error message", async () => {
    const configError = await $('[data-automation="missing-config"]');
    const configErrorMessage =
      "The last Configuration used for this Deployment was not found. Create a Configuration.";
    await expect(configError).toHaveText(configErrorMessage);
  });

  it("Credentials Details shows error message", async () => {
    const credsError = await $('[data-automation="missing-creds"]');
    const credsErrorMessage =
      "A Credential for the Deployment's server URL was not found. Create a new Credential.";
    await expect(credsError).toHaveText(credsErrorMessage);
  });

  it("Verify Deploy button is disabled", async () => {
    const deployButton = await $('[data-automation="deploy-button"]');
    const getDeployButtonStatus = await deployButton.getAttribute("class");
    expect(getDeployButtonStatus).toContain("disabled");
  });

  it("Recover config", async () => {
    const configButton = await $('[data-automation="config-button"]');
    await configButton.click();

    await browser.switchToFrame(null);

    const titleMessage = await browser.$("#quickInput_message");
    await expect(titleMessage).toHaveText(
      "Enter a title for your content or application. (Press 'Enter' to confirm or 'Escape' to cancel)",
    );

    await input.setValue(title);
    await browser.keys("\uE007");
  });

  it("can check config", async () => {
    const realFilename = await helper.getConfigTitle(/^my fastapi app-.*$/);

    const filePath = path.resolve(
      __dirname,
      "../../../sample-content/fastapi-simple/.posit/publish/" + realFilename,
    );
    const fileContent = fs.readFileSync(filePath, "utf8");
    const pythonVersion = process.env.PYTHON_VERSION;
    await expect(fileContent).toContain(
      `type = 'python-fastapi'\nentrypoint = 'simple.py'\nvalidate = true\nfiles = [\n  '/simple.py',\n  '/requirements.txt'\n]\ntitle = 'my fastapi app'\n\n[python]\nversion = '${pythonVersion}'\npackage_file = 'requirements.txt'\npackage_manager = 'pip'`,
    );
    // close editor
    await workbench.getEditorView().closeEditor(realFilename);
  });

  it("Recover creds", async () => {
    await helper.switchToSubframe();
    const credsButton = await $('[data-automation="creds-button"]');
    await credsButton.click();

    await browser.switchToFrame(null);

    const titleMessage = await browser.$("#quickInput_message");
    await expect(titleMessage).toHaveText(
      "Enter the Public URL of the Posit Connect Server (Press 'Enter' to confirm or 'Escape' to cancel)",
    );

    // set server url
    await input.setValue(connectServer);
    await browser.keys("\uE007");

    // wait until the server responds
    await helper.waitForInputFields("The API key to be used");

    //set api key
    await input.setValue(apiKey);
    await browser.keys("\uE007");

    // wait for server validation
    await helper.waitForInputFields("Enter a unique nickname for this server");

    // set server name
    await input.setValue("my connect server");
    await browser.keys("\uE007");
  });

  after(async () => {
    const parentDir = path.resolve(
      __dirname,
      "../../../sample-content/fastapi-simple",
    );
    const positDir = path.join(parentDir, ".posit");

    // Log the contents of the parent directory
    console.log(fs.readdirSync(parentDir));

    // Check if the directory exists before trying to delete it
    if (fs.existsSync(positDir)) {
      // Get the files in the directory
      const files = fs.readdirSync(positDir);

      // Delete each file in the directory
      for (const file of files) {
        const filePath = path.join(positDir, file);
        if (fs.lstatSync(filePath).isDirectory()) {
          fs.rmdirSync(filePath, { recursive: true }); // Delete directory recursively
        } else {
          fs.unlinkSync(filePath); // Delete file
        }
      }

      // Delete the directory
      fs.rmdirSync(positDir);
    } else {
      console.log("Directory does not exist");
    }
  });
});
