import { browser, $ } from "@wdio/globals";

import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import {
  runShellScript,
  switchToSubframe,
  waitForInputFields,
} from "../helpers.ts";

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

  it("can add deployment", async () => {
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

    // verify each entrypoint is found and listed
    const quickpick = await browser.$(".quick-input-list");
    await quickpick.waitForExist({ timeout: 30000 });
  });

  it("can list simplepy entrypoint", async () => {
    const simplepy = browser.$(`aria/fastapi-simple${sep}simple.py`);
    await expect(simplepy).toExist();
  });

  it("can list quartoProjNoneMulti entrypoint", async () => {
    const quartoProjNoneMulti = browser.$(
      `aria/quarto-proj-none${sep}quarto-proj-none.qmd`,
    );
    await expect(quartoProjNoneMulti).toExist();
  });

  it("can list simplepyMulti entrypoint", async () => {
    const simplepyMulti = browser.$(`aria/multi-type${sep}simple.py`);
    await expect(simplepyMulti).toExist();
  });

  it("can list quartoProjNone entrypoint", async () => {
    const quartoProjNone = browser.$(
      `aria/quarto-proj-none${sep}quarto-proj-none.qmd`,
    );
    await expect(quartoProjNone).toExist();
  });

  it("can list quartoProjPy entrypoint", async () => {
    const quartoProjPy = browser.$(
      `aria/quarto-proj-py${sep}quarto-proj-py.qmd`,
    );
    await expect(quartoProjPy).toExist();
  });

  it("can list quartoProjR entrypoint", async () => {
    const quartoProjR = browser.$(`aria/quarto-proj-r${sep}quarto-proj-r.qmd`);
    await expect(quartoProjR).toExist();
  });

  it("can list quartoProject entrypoint", async () => {
    const quartoProject = browser.$(
      `aria/quarto-project${sep}quarto-project.qmd`,
    );
    await expect(quartoProject).toExist();
  });

  it("can list rmdHtml entrypoint", async () => {
    const rmdHtml = browser.$(`aria/rmd-static-1${sep}index.htm`);
    await expect(rmdHtml).toExist();
  });

  it("can list rmdKnitr entrypoint", async () => {
    const rmdKnitr = browser.$(`aria/rmd-static-1${sep}static.Rmd`);
    await expect(rmdKnitr).toExist();
  });

  it("can list shiny entrypoint", async () => {
    const shiny = browser.$(`aria/shinyapp${sep}app.R`);
    await expect(shiny).toExist();
  });

  it("can list shinyHtml entrypoint", async () => {
    const shinyHtml = browser.$(`aria/shinyapp${sep}index.htm`);
    await expect(shinyHtml).toExist();
  });

  it("can select entrypoint", async () => {
    const simplepy = browser.$(`aria/fastapi-simple${sep}simple.py`);
    await expect(simplepy).toExist();
    await simplepy.click();

    const titleMessage = browser.$("#quickInput_message");
    await expect(titleMessage).toHaveText(
      "Enter a title for your content or application. (Press 'Enter' to confirm or 'Escape' to cancel)",
    );
    // await input.waitForExist({ timeout: 30000 });

    // set title
    await input.setValue("my fastapi app");
    await browser.keys("\uE007");

    // set server url
    await input.setValue(connectServer);
    await browser.keys("\uE007");

    // wait until the server responds
    await waitForInputFields("The API key to be used");

    //set api key
    await input.setValue(apiKey);
    await browser.keys("\uE007");

    // wait for server validation
    await waitForInputFields("Enter a Unique Nickname");

    // set server name
    await input.setValue("my connect server");
    await browser.keys("\uE007");
  });

  it("can check config", async () => {
    const workbench = await browser.getWorkbench();
    await expect(
      await workbench.getEditorView().getOpenEditorTitles(),
    ).toContain("configuration-1.toml");
    const filePath = path.resolve(
      __dirname,
      "../../../sample-content/fastapi-simple/.posit/publish/configuration-1.toml",
    );
    const fileContent = fs.readFileSync(filePath, "utf8");
    await expect(fileContent).toContain(
      "type = 'python-fastapi'\nentrypoint = 'simple.py'\nvalidate = true\nfiles = ['simple.py', 'requirements.txt']\ntitle = 'my fastapi app'",
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
        scriptPath = "cd ../scripts && cleanup.bash";
        await runShellScript(scriptPath);
      });
    });
  });
});
