import { browser, $, expect } from "@wdio/globals";

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

async function switchToSubframe() {
  await browser.$(".webview");
  const iframe = await browser.$("iframe");
  await browser.switchToFrame(iframe);

  await browser.$("iframe").waitForExist({ timeout: 30000 });
  const subiframe = await browser.$("iframe");
  await subiframe.waitForExist({ timeout: 30000 });
  await browser.switchToFrame(subiframe);
}

const connectServer = process.env.CONNECT_SERVER;
const apiKey = process.env.CONNECT_API_KEY;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function waitForInputFields(inputText: string) {
  // wait until the server responds
  await browser.waitUntil(
    async () => {
      const element = await browser.$("#quickInput_message");
      const text = await element.getText();
      return text.includes(inputText);
    },
    {
      timeout: 10000, // Timeout in milliseconds, adjust as necessary
      timeoutMsg:
        "Expected element signifying server response did not appear within timeout",
    },
  );
}

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

  it("create first deployment", async () => {
    await switchToSubframe();
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
    await input.setValue("fastapi-test");
    await browser.keys("\uE007");

    // set server url
    await input.setValue(connectServer);
    await browser.keys("\uE007");

    // wait until the server responds
    await waitForInputFields("The API key to be used");

    //set api key
    await input.setValue(apiKey);
    await browser.keys("\uE007");

    // wait for validation
    await waitForInputFields("Enter a unique nickname for this server");

    // set server name
    await input.setValue("my connect server");
    await browser.keys("\uE007");
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
  });
});
