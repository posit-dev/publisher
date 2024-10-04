// /Users/kgartland/work/publishing-client/test/vscode-ui/test/pages/PublisherPage.ts
import { browser, $ } from "@wdio/globals";
import * as helper from "../helpers.ts";

class Deployment {
  async clickAddDeployment() {
    await helper.switchToSubframe();
    const addDeploymentButton = await $("aria/Add Deployment");
    await addDeploymentButton.waitForExist({ timeout: 30000 });
    await addDeploymentButton.click();
  }

  async clickCreateNewDeployment() {
    await browser.switchToFrame(null);
    // verify Create New Deployment message displays and select it
    await browser.switchToFrame(null);
    const createMessage = await browser.$(".quick-input-title");
    await expect(createMessage).toHaveText("Create a New Deployment");
    await createMessage.click();

    // verify each entrypoint is found and listed
    const quickpick = await browser.$(".quick-input-list");
    await quickpick.waitForExist({ timeout: 30000 });
  }

  async clickSelectButton() {
    await helper.switchToSubframe();
    const selectButton = (await $('[data-automation="select-deployment"]')).$(
      ".quick-pick-label",
    );
    await expect(selectButton).toHaveText("Select...");
    await selectButton.click();
  }

  async clickEditConfig() {
    await helper.switchToSubframe();
    // initialize project via button
    const editConfig = await $("aria/Edit Configuration");
    await editConfig.click();
  }

  async clickMoreDeploymentActions() {
    await helper.switchToSubframe();
    const deploymentActions = await $("aria/Deployment actions");
    await deploymentActions.click();
  }

  async clickOpenFile() {
    const openFile = await browser.$(".label-name");
    await expect(openFile).toHaveText("Open...");
    await openFile.click();
  }
}

export default new Deployment();
