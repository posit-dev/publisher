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

    const extension = await browser.$("aria/Posit Publisher");
    await expect(extension).toExist();

    await extension.click();

    // initialize project via button
    const init = await browser.$("aria/Configurations Section");
    await expect(init).toHaveText("CONFIGURATIONS");
    await init.click();

    const newConfig = await browser.$(".monaco-button");

    await expect(newConfig).toHaveText("New Configuration");
    await newConfig.click();

    // name configuration and save
    const actionbar = await browser.$("#quickInput_message");

    await expect(actionbar).toHaveText(
      "Configuration name (Press 'Enter' to confirm or 'Escape' to cancel)",
    );
    await browser.keys("blue");
    await browser.keys([Key.Enter]);

    const defaultTextElement = await browser
      .$(".monaco-pane-view")
      .$$(".split-view-view")[3]
      .$(".pane")
      .$(".pane-body");
    // .$(".pane-body");

    await expect(defaultTextElement).toHaveText("blue");

    // confirm config file is created
    const configFile = path.join(
      __dirname,
      "../../../sample-content/fastapi-simple/.posit/publish/blue.toml",
    );
    expect(fs.existsSync(configFile)).toBeTruthy();

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