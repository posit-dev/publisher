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

describe("Detect error in config", () => {
  let workbench: any;
  let input: any;

  before(async () => {
    workbench = await browser.getWorkbench();
    input = await $(".input");
    const extension = await browser.$("aria/Posit Publisher");
    await extension.waitForExist({ timeout: 30000 });
    await extension.click();
    await expect(await browser.$("aria/Posit Publisher")).toExist();
  });

  it("Dropdown shows proper error", async () => {
    // only create Deployment and error in Config file
    await helper.createFastAPIDeploymentFile();
    await helper.createErrorFastAPIConfigFile();

    // initialize project via button
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
      'div.monaco-list-row[aria-label*="Unknown Title • Error in fastapi-simple-VO48"]';
    const element = await browser.$(createMessage);
    await element.click();
  });

  it("Deployment Details shows error message", async () => {
    await helper.switchToSubframe();
    // verify deployment details error message
    const deploymentName = await $('[data-automation="entrypoint-label"]');
    const deploymentDetails = `Unknown Title • Error in fastapi-simple-VO48\nMissing Credential for https://rsc.radixu.com\nProjectDir and Entrypoint not determined`;
    await expect(deploymentName).toHaveText(deploymentDetails);
  });

  it("Configuration Details shows error message", async () => {
    const configError = await $('[data-automation="edit-config"]');
    const configErrorMessage =
      "The selected Configuration has an error. Edit the Configuration.";
    await expect(configError).toHaveText(configErrorMessage);
  });

  it("Fix config", async () => {
    const configButton = await $('[data-automation="edit-config-button"]');
    await configButton.click();

    await browser.switchToFrame(null);

    const realFilename = await helper.getConfigTitle(/^fastapi-simple-.*$/);
    expect(await workbench.getEditorView().getOpenEditorTitles()).toContain(
      realFilename,

      // const titleMessage = await browser.$("#quickInput_message");
      // await expect(titleMessage).toHaveText(
      //   "Enter a title for your content or application. (Press 'Enter' to confirm or 'Escape' to cancel)",
    );
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
