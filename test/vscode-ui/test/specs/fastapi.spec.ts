import { browser, $, expect } from "@wdio/globals";

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import * as helper from "../helpers.ts";
import Publisher from "../pages/Publisher.ts";
import Deployment from "../pages/Deployment.ts";

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
    await Publisher.openExtension();
    await expect(await browser.$("aria/Posit Publisher")).toExist();
  });

  it("create configuration", async () => {
    await Deployment.clickSelectButton();

    // switch out of iframe
    await browser.switchToFrame(null);

    // verify Create New Deployment message displays and select it
    await Deployment.clickCreateNewDeployment();
    await Deployment.clickOpenFile();

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
    await helper.waitForInputFields("Enter a Unique Nickname");

    // set server name
    await input.setValue("my connect server");
    await browser.keys("\uE007");
  });

  it("check configuration file", async () => {
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
});
