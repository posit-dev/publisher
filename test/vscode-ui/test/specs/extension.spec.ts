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
    $(".add-deployment-btn").waitForExist({ timeout: 30000 });
    const init = await $(".add-deployment-btn");

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
    await workbench.executeCommand(
      "vscode.commands.executeCommand('posit.publisher.configurations.focus')",
    );
    const configLabel = await browser
      .$(".monaco-icon-label")
      .getAttribute("aria-label");
    configLabel.includes("Configuration file:");

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
  });
});
