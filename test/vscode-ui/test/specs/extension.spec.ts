import { browser, expect } from "@wdio/globals";
import { Key } from "webdriverio";
import * as fs from "fs";
// const path = require("path");
import * as path from "path";

// import { execSync } from 'child_process';
import { fileURLToPath } from "url";
import { dirname } from "path";

describe("VS Code Extension UI Test", () => {
  // it("should install the extension", () => {

  // });

  it("should add a configuration when the button is clicked", async () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    // open posit extension
    const extension = await browser.$("aria/Posit Publisher");
    await expect(extension).toExist();
    await extension.click();

    // initialize project via button
    const init = await browser.$(".welcome-view-content").$("a.monaco-button");
    await expect(init).toHaveText("Initialize Project");
    await init.click();

    // name configuration and save
    // const actionbar = await browser.$("#quickInput_message");
    // await expect(actionbar).toHaveText(
    //   "Configuration name (Press 'Enter' to confirm or 'Escape' to cancel)",
    // );
    // await browser.keys("blue");
    // await browser.keys([Key.Enter]);

    // click advanced mode
    const advancedMode = await browser.$("aria/Show Advanced Mode");
    await expect(advancedMode).toExist();
    await advancedMode.click();

    // check configuration project via button
    // const config = await browser.$("aria/Configurations Section");
    // await expect(config).toHaveText("CONFIGURATIONS");
    // await config.click();

    // scroll to see configuration button
    // const element = await browser
    //   .$(".monaco-pane-view")
    //   .$$(".split-view-view")[1]
    //   .$(".pane")
    //   .$(".pane-body")
    //   .$(".monaco-button");
    // await element.scrollIntoView();

    // // click new configuration button
    // const newConfig = await browser.$(".monaco-button");
    // await expect(newConfig).toHaveText("New Configuration");
    // await newConfig.click();

    const config = await browser
      .$(".monaco-pane-view")
      .$$(".split-view-view")[1]
      .$(".pane")
      .$(".pane-body");
    await expect(config).toHaveText("default");

    // confirm config file is created
    const configFile = path.join(
      __dirname,
      "../../../sample-content/fastapi-simple/.posit/publish/default.toml",
    );
    expect(fs.existsSync(configFile)).toBeTruthy();

    const deployments = await browser
      .$(".monaco-pane-view")
      .$$(".split-view-view")[3]
      .$(".pane")
      .$(".pane-body");
    await expect(deployments).toHaveText("Untitled-1");

    // confirm config file is created
    const deployFile = path.join(
      __dirname,
      "../../../sample-content/fastapi-simple/.posit/publish/deployments/Untitled-1.toml",
    );
    expect(fs.existsSync(deployFile)).toBeTruthy();

    // add deployment
    // const newDeploy = await browser
    // .$(".monaco-pane-view")
    // .$$(".split-view-view")[3]
    // .$(".pane")
    // .$(".pane-header")
    // .$(".monaco-toolbar")
    // .$("codicon-add");
    // await newDeploy.click();
    // await browser.keys([Key.Enter]);
    deployments.click();
    const newDeploy = await browser.$("aria/Initiate New Deployment");
    newDeploy.click();

    // name configuration and save
    // const actionbar = await browser.$("#quickInput_message");
    // await expect(actionbar).toHaveText(
    //   "Configuration name (Press 'Enter' to confirm or 'Escape' to cancel)",
    // );
    // await browser.keys("blue");
    // await browser.keys([Key.Enter]);
    const actionbar = await browser.$("#quickInput_message");
    await expect(actionbar).toHaveText(
      "Choose a unique name for the deployment (Press 'Enter' to confirm or 'Escape' to cancel)",
    );
    await browser.keys([Key.Enter]);
    await browser.keys([Key.ArrowDown]);
    await browser.keys([Key.Enter]);

    await expect(deployments).toHaveText(expect.stringContaining("Untitled-2"));

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
});
