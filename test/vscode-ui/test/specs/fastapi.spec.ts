import { browser, $, expect } from "@wdio/globals";

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import * as helper from "../helpers.ts";

const connectServer = process.env.CONNECT_SERVER;
const apiKey = process.env.CONNECT_API_KEY;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("VS Code Extension UI Test", () => {
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

  it("can click select button", async () => {
    await helper.switchToSubframe();
    // initialize project via button
    const selectButton = (await $('[data-automation="select-deployment"]')).$(
      ".quick-pick-label",
    );
    await expect(selectButton).toHaveText("Select...");
    await selectButton.click();

    // switch out of iframe
    await browser.switchToFrame(null);

    // verify Create New Deployment message displays and select it
    const createMessage = await browser.$(".label-name");
    await expect(createMessage).toHaveText("Create a New Deployment");
    await createMessage.click();

    const openFile = await browser.$(".label-name");
    await expect(createMessage).toHaveText("Open...");
    await openFile.click();

    const simplepy = browser.$(`aria/simple.py`);
    await simplepy.click();

    const titleMessage = browser.$("#quickInput_message");
    await expect(titleMessage).toHaveText(
      "Enter a title for your content or application. (Press 'Enter' to confirm or 'Escape' to cancel)",
    );

    await input.setValue("my fastapi app");
    await browser.keys("\uE007");
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

  it("can check config", async () => {
    const realFilename = await helper.getConfigTitle(/^my fastapi app-.*$/);
    const pythonVersion = process.env.PYTHON_VERSION;

    const filePath = path.resolve(
      __dirname,
      "../../../sample-content/fastapi-simple/.posit/publish/" + realFilename,
    );
    const fileContent = fs.readFileSync(filePath, "utf8");
    const expectedPattern = new RegExp(
      `type = 'python-fastapi'\\n` +
        `entrypoint = 'simple.py'\\n` +
        `validate = true\\nfiles = \\[\\n` +
        `  '/simple.py',\\n` +
        `  '/requirements.txt',\\n` +
        `  '/.posit/publish/${realFilename}',\\n` +
        `  '/.posit/publish/deployments/deployment-.*.toml'\\n` +
        `\\]\\n` +
        `title = 'my fastapi app'\\n\\n` +
        `\\[python\\]\\n` +
        `version = '${pythonVersion}'\\n` +
        `package_file = 'requirements.txt'\\n` +
        `package_manager = 'pip'`,
    );

    expect(fileContent).toMatch(expectedPattern);
  });
});
