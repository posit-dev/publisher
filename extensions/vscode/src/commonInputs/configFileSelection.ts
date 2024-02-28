import { AccountAuthType, useApi } from "src/api";
import { getSummaryStringFromError } from "src/utils/errors";
import { QuickPickItem, ThemeIcon, window } from "vscode";

export class ConfigFileSelection {
  private api = useApi();

  public accountListItems: QuickPickItem[] = [];

  constructor() {
    this.refresh();
  }

  public async refresh() {
    try {
      const response = await this.api.accounts.getAll();
      const accounts = response.data.accounts;
      this.accountListItems = accounts.map(account => ({
        iconPath: new ThemeIcon('account'),
        label: account.name,
        description: account.source,
        detail: account.authType === AccountAuthType.API_KEY
          ? 'Using API Key'
          : `Using Token Auth for ${account.accountName}`,
      }));
    } catch (error: unknown) {
      const summary = getSummaryStringFromError('ConfigFileSelection::refresh', error);
      window.showInformationMessage(
        `Unable to continue with no credentials. ${summary}`
      );
      return;
    }
  }


}