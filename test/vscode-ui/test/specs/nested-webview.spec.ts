import { browser, $ } from "@wdio/globals";

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { switchToSubframe, waitForInputFields } from "../helpers.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const connectServer = process.env.CONNECT_SERVER;
const apiKey = process.env.CONNECT_API_KEY;

const sep = path.sep;

describe("Nested Fast API Deployment", () => {
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

  it("can click +", async () => {
    await switchToSubframe();
    // initialize project via button
    const addDeployment = await $("aria/Add Deployment");
    // await expect(addDeployment).toHaveText("Select...");
    await addDeployment.click();

    // switch out of iframe
    await browser.switchToFrame(null);

    // verify Create New Deployment message displays and select it
    const createMessage = await browser.$(".quick-input-title");
    await expect(createMessage).toHaveText("Create a New Deployment");
    await createMessage.click();

    // verify each entrypoint is found and listed
    const quickpick = await browser.$(".quick-input-list");
    await quickpick.waitForExist({ timeout: 30000 });
  });
});
