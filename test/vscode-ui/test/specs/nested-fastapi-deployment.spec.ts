import { browser, $ } from "@wdio/globals";
import * as path from "path";
import * as helper from "../helpers.ts";
import Publisher from "../pages/Publisher.ts";
import Deployment from "../pages/Deployment.ts";

const sep = path.sep;
const title = "my fastapi app";
describe("Nested Fast API Deployment", () => {
  let workbench: any;
  let input: any;

  before(async () => {
    workbench = await browser.getWorkbench();
    input = await $(".input");
    await Publisher.openExtension();
    await expect(await browser.$("aria/Posit Publisher")).toExist();
  });

  it("can click +", async () => {
    await Deployment.clickAddDeployment();
    await Deployment.clickCreateNewDeployment();
    // esc
    await browser.keys("\uE00C");
  });

  it("can continue deployment", async () => {
    await Deployment.clickSelectButton();
    // switch out of iframe
    await browser.switchToFrame(null);
    const myConfig = browser.$(
      `aria/my connect server • fastapi-simple${sep}simple.py`,
    );
    await expect(myConfig).toExist();
    myConfig.click();
  });

  it("can edit config", async () => {
    await Deployment.clickEditConfig();

    await browser.switchToFrame(null);
    const realFilename = await helper.getConfigTitle(/^my fastapi app-.*$/);
    expect(await workbench.getEditorView().getOpenEditorTitles()).toContain(
      realFilename,
    );
    // close editor
    await workbench.getEditorView().closeEditor(realFilename);
  });

  it("can access more deloyment actions", async () => {
    await Deployment.clickMoreDeploymentActions();
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
