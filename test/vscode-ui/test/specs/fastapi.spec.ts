import { browser, $, expect } from "@wdio/globals";

import * as os from "os";
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

  it("can click add deployment button", async () => {
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

    // confirm title is ready and set title
    const titleMessage = await browser.$("#quickInput_message");
    await titleMessage.waitForExist({ timeout: 5000 });
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
    await helper.waitForInputFields("Enter a Unique Nickname");

    // set server name
    await input.setValue("my connect server");
    await browser.keys("\uE007");
  });

  it("can check config", async () => {
    const realFilename = await helper.getConfigTitle(/^my fastapi app-.*$/);

    const filePath = path.resolve(
      __dirname,
      "../../../sample-content/fastapi-simple/.posit/publish/" + realFilename,
    );
    const fileContent = fs.readFileSync(filePath, "utf8");
    await expect(fileContent).toContain(
      "type = 'python-fastapi'\nentrypoint = 'simple.py'\nvalidate = true\nfiles = [\n  '/simple.py',\n  '/requirements.txt'\n]\ntitle = 'my fastapi app'",
    );
  });

  // cleanup
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

    // Use shell script to delete credentials
    describe("Cleanup creds", () => {
      it("remove credentials", async () => {
        let scriptPath: string;
        scriptPath = "cd ../scripts && bash cleanup.bash";
        await helper.runShellScript(scriptPath);
      });
    });
  });
});
