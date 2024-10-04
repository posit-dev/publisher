// /Users/kgartland/work/publishing-client/test/vscode-ui/test/pages/PublisherPage.ts
import { $, browser } from "@wdio/globals";

class PublisherPage {
  async openExtension() {
    const extension = await browser.$("aria/Posit Publisher");
    await extension.waitForExist({ timeout: 30000 });
    await extension.click();
  }

  async clickSelectButton() {
    await browser.switchToFrame(null); // Ensure you are in the correct frame
    const selectButton = (await $('[data-automation="select-deployment"]')).$(
      ".quick-pick-label",
    );
    await selectButton.waitForExist();
    await selectButton.click();
  }
}

export default new PublisherPage();
