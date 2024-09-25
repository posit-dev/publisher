import { browser, $ } from "@wdio/globals";
import * as path from "path";
import * as helper from "../helpers.ts";

const sep = path.sep;
const title = "my fastapi app";
describe("Nested Fast API Deployment", () => {
  let workbench: any;

  before(async () => {
    workbench = await browser.getWorkbench();
  });

  it("open extension", async () => {
    browser.$("aria/Posit Publisher").waitForExist({ timeout: 30000 });
    // open posit extension
    const extension = await browser.$("aria/Posit Publisher");
    await expect(extension).toExist();
    await extension.click();
  });

  it("can click +", async () => {
    await helper.switchToSubframe();
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
    // esc
    await browser.keys("\uE00C");
  });

  it("can continue deployment", async () => {
    await helper.switchToSubframe();
    // initialize project via button
    const selectButton = (await $('[data-automation="select-deployment"]')).$(
      ".quick-pick-label",
    );
    await expect(selectButton).toHaveText("Select...");
    await selectButton.click();

    // switch out of iframe
    await browser.switchToFrame(null);
    const myConfig = browser.$(
      `aria/my connect server • fastapi-simple${sep}simple.py`,
    );
    await expect(myConfig).toExist();
    myConfig.click();
  });

  it("can edit config", async () => {
    await helper.switchToSubframe();
    // initialize project via button
    const editConfig = await $("aria/Edit Configuration");
    await editConfig.click();
    await browser.switchToFrame(null);
    const realFilename = await helper.getConfigTitle(/^my fastapi app-.*$/);
    expect(await workbench.getEditorView().getOpenEditorTitles()).toContain(
      realFilename,
    );
    // close editor
    await workbench.getEditorView().closeEditor(realFilename);
  });

  it("can click more deloyment actions", async () => {
    await helper.switchToSubframe();
    const deploymentActions = await $("aria/Deployment actions");
    await deploymentActions.click();
    // cannot access the menu here in wdio
    // exit menu
    await browser.keys("\uE00C");
  });

  it("can confirm Deployment Title", async () => {
    const deployment = await $(".quick-pick-label");
    await expect(deployment).toHaveText(title);
  });

  it("can confirm Deployment Credentails", async () => {
    const deployment = await $(".quick-pick-detail");
    await expect(deployment).toHaveText("my connect server");
  });

  it("can confirm Deployment Details", async () => {
    const deploymentName = await $('[data-automation="entrypoint-label"]');
    const deploymentDetails = `my fastapi app\nmy connect server\nfastapi-simple${sep}simple.py`;
    await expect(deploymentName).toHaveText(deploymentDetails);
  });

  it("can confirm Deployment Status", async () => {
    // const deploymentStatus = await $('.deployment-summary');
    const deploymentStatus = await $('[data-automation="deploy-status"]');
    await expect(deploymentStatus).toHaveText("Not Yet Deployed");
  });

  it("can verify Project Files", async () => {
    // const deploymentStatus = await $('.deployment-summary');
    const deploymentStatus = await $('[data-automation="deploy-status"]');
    await expect(deploymentStatus).toHaveText("Not Yet Deployed");
    const reqFile = await $("aria/requirements.txt");
    await expect(reqFile).toExist();
    const simpleFile = await $("aria/simple.py");
    await expect(simpleFile).toExist();
    const reqFileDecorator = await $(
      '[data-automation="requirements.txt-decorator"]',
    );
    await expect(reqFileDecorator).toHaveText("A");
    const simpleFileDecorator = await $(
      '[data-automation="simple.py-decorator"]',
    );
    await expect(simpleFileDecorator).toHaveText("A");
  });

  it("can verify Python Packages", async () => {
    const pythonPackages = await $('[data-automation="python-packages"]');
    await pythonPackages.click();
    const reqfastapi = await $('[data-automation="req"]');
    await expect(reqfastapi).toHaveText("fastapi");
  });

  it("can edit python packages file", async () => {
    const editPackages = await $("aria/Edit Package Requirements File");
    await editPackages.click();
    // exit iFrame to focus on editor
    await browser.switchToFrame(null);
    expect(await workbench.getEditorView().getOpenEditorTitles()).toContain(
      "requirements.txt",
    );
  });

  it("can verify R Packages", async () => {
    await helper.switchToSubframe();
    const pythonPackages = await $('[data-automation="r-packages"]');
    await pythonPackages.click();
    const notConfigured = await $('[data-automation="r-not-configured"]');
    await expect(notConfigured).toHaveText(
      "This project is not configured to use R. To configure R, add an [r] section to your configuration file.",
    );
  });

  it("can list creds", async () => {
    const creds = await $('[data-automation="credentials"]');
    await creds.click();
    const credentialList = await $(
      '[data-automation="my connect server-list"]',
    );
    await expect(credentialList).toHaveText(
      `my connect server\n` + process.env.CONNECT_SERVER,
    );
  });

  it("can deploy", async () => {
    const deploy = await $('[data-automation="deploy-button"]');
    await deploy.click();
    const deploymentProgress = await $(
      '[data-automation="deployment-progress"]',
    );
    await expect(deploymentProgress).toHaveText("Deployment in Progress...");
  });

  it("can verify Deployment Success", async () => {
    const deploymentStatus = await $('[data-automation="deploy-status"]');
    await expect(deploymentStatus).toHaveText("Last Deployment Successful");
  });
});
