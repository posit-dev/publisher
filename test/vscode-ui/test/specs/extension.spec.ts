import { browser, expect } from "@wdio/globals";
import { Key } from "webdriverio";
import * as fs from "fs";
// const path = require("path");
import * as path from "path";

// import { execSync } from 'child_process';
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

// import * as vscode from 'vscode';
// await vscode.commands.executeCommand('workbench.extensions.action.enableAll');
describe("VS Code Extension UI Test", () => {
  // it("should install the extension", () => {

  // });

  it("create first deployment", async () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    await delay(15000);

    // open posit extension
    const extension = await browser.$("aria/Posit Publisher");
    await expect(extension).toExist();
    await extension.click();

    await switchToSubframe();

    // const subiframe = await browser.$('iframe');
    // await browser.switchToFrame(subiframe);

    // initialize project via button
    const init = await browser.$(".add-deployment-btn");
    // .$(">>>#active-frame")
    // .$('>>>.easy-deploy-container');
    await expect(init).toHaveText("Add Deployment");
    await init.click();

    await browser.switchToFrame(null);

    const inputServer = await browser.$(".input");
    await inputServer.setValue("https://rsc.radixu.com");
    await browser.keys("\uE007");

    const inputName = await browser.$(".input");
    await inputName.setValue("dogfood");
    await browser.keys("\uE007");

    const inputKey = await browser.$(".input");
    await inputKey.setValue("bKnYIJiJasSulZcbUlhZ4UkMYdL7YCWq");
    await browser.keys("\uE007");

    const inputTitle = await browser.$(".input");
    await inputTitle.setValue("fastapi-test");
    await browser.keys("\uE007");
  });

  // it("check config", async () => {
  //   await switchToSubframe();
  //   await delay(30000);

  //   const config = await browser.$('.monaco-list list_id_3');
  //   await expect(config).toHaveText("configuration-1");

  // });
});

// // confirm config file is created
// const configFile = path.join(
//   __dirname,
//   "../../../sample-content/fastapi-simple/.posit/publish/default.toml",
// );
// expect(fs.existsSync(configFile)).toBeTruthy();

// const deployments = await browser
//   .$(".monaco-pane-view")
//   .$$(".split-view-view")[3]
//   .$(".pane")
//   .$(".pane-body");
// await expect(deployments).toHaveText("Untitled-1");

// // confirm config file is created
// const deployFile = path.join(
//   __dirname,
//   "../../../sample-content/fastapi-simple/.posit/publish/deployments/Untitled-1.toml",
// );
// expect(fs.existsSync(deployFile)).toBeTruthy();

// deployments.click();
// const newDeploy = await browser.$("aria/Initiate New Deployment");
// newDeploy.click();

// const actionbar = await browser.$("#quickInput_message");
// await expect(actionbar).toHaveText(
//   "Choose a unique name for the deployment (Press 'Enter' to confirm or 'Escape' to cancel)",
// );
// await browser.keys([Key.Enter]);
// await browser.keys([Key.ArrowDown]);
// await browser.keys([Key.Enter]);

// await expect(deployments).toHaveText(expect.stringContaining("Untitled-2"));

// // cleanup
// after(async () => {
//   const parentDir = path.resolve(
//     __dirname,
//     "../../../sample-content/fastapi-simple",
//   );
//   const positDir = path.join(parentDir, ".posit");

//   // Log the contents of the parent directory
//   console.log(fs.readdirSync(parentDir));

//   // Check if the directory exists before trying to delete it
//   if (fs.existsSync(positDir)) {
//     // Get the files in the directory
//     const files = fs.readdirSync(positDir);

//     // Delete each file in the directory
//     for (const file of files) {
//       const filePath = path.join(positDir, file);
//       if (fs.lstatSync(filePath).isDirectory()) {
//         fs.rmdirSync(filePath, { recursive: true }); // Delete directory recursively
//       } else {
//         fs.unlinkSync(filePath); // Delete file
//       }
//     }

//     // Delete the directory
//     fs.rmdirSync(positDir);
//   } else {
//     console.log("Directory does not exist");
//   }
// });
