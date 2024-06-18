import { browser, $, expect } from "@wdio/globals";

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function switchToSubframe() {
  await browser.$(".webview");
  const iframe = await browser.$("iframe");
  await browser.switchToFrame(iframe);

  await delay(15000);

  const subiframe = await browser.$("iframe");
  await browser.switchToFrame(subiframe);
}

function generateRandomString(length = 10) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

const serverName = generateRandomString();
const apiKey = generateRandomString(32);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// const input = await $(".input");

describe("VS Code Extension UI Test", () => {
  let workbench: any;
  let input: any;
  let enterKey: any;

  before(async () => {
    workbench = await browser.getWorkbench();
    input = await $(".input");
    enterKey = await browser.keys("\uE007");
  });

  it("open extension", async () => {
    await delay(15000);

    // open posit extension
    const extension = await browser.$("aria/Posit Publisher");
    await expect(extension).toExist();
    await extension.click();
  });

  it("create first deployment", async () => {
    await switchToSubframe();

    // const subiframe = await browser.$('iframe');
    // await browser.switchToFrame(subiframe);

    // initialize project via button
    const init = await $(".add-deployment-btn");
    // .$(">>>#active-frame")
    // .$('>>>.easy-deploy-container');
    await expect(init).toHaveText("Add Deployment");
    await init.click();

    await browser.switchToFrame(null);
    // set server url
    await input.setValue("https://rsc.radixu.com");
    await browser.keys("\uE007");
    // set server name
    await input.setValue(serverName);
    await browser.keys("\uE007");
    //set api key
    await input.setValue(apiKey);
    await browser.keys("\uE007");
    // set title
    await input.setValue("fastapi-test");
    await browser.keys("\uE007");
  });

  it("check config", async () => {
    // await switchToSubframe();

    await workbench.executeCommand(
      "vscode.commands.executeCommand('posit.publisher.configurations.focus')",
    );
    // await delay(30000);
    const config = await browser.$(".monaco-icon-label-container");
    await expect(config).toHaveText("configuration-1");
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

    // Clear the creds
    // const creds = await browser.$("aria/"+serverName);
    // await creds.click({ button: 'right' });
  });
});
