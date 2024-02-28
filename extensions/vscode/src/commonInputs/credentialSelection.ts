import { useApi } from "src/api";
import { getSummaryStringFromError } from "src/utils/errors";
import { QuickPickItem, ThemeIcon, window } from "vscode";

export class CredentialSelection {
  private api = useApi();

  public configFileListItems: QuickPickItem[] = [];

  constructor() {
    this.refresh();
  }

  public async refresh() {
    try {
      const response = await this.api.configurations.getAll();
      const configurations = response.data;
      this.configFileListItems = configurations.map(configuration => ({
        iconPath: new ThemeIcon('file-code'),
        label: configuration.configurationName,
        detail: configuration.configurationPath,
      }));
    } catch (error: unknown) {
      const summary = getSummaryStringFromError('CredentialSelection::refresh', error);
      window.showInformationMessage(
        `Unable to continue with no configurations. ${summary}`
      );
      return;
    }
  }


}