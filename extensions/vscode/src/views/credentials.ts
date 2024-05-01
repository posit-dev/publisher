// Copyright (C) 2024 by Posit Software, PBC.

import {
  Event,
  EventEmitter,
  ExtensionContext,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  commands,
  window,
} from "vscode";

import { Account, useApi } from "src/api";
import { getSummaryStringFromError } from "src/utils/errors";

const viewName = "posit.publisher.credentials";
const refreshCommand = viewName + ".refresh";
const contextIsEmpty = viewName + ".isEmpty";
const addCommand = viewName + ".add";

type CredentialEventEmitter = EventEmitter<
  CredentialsTreeItem | undefined | void
>;

type CredentialEvent = Event<CredentialsTreeItem | undefined | void>;

export class CredentialsTreeDataProvider
  implements TreeDataProvider<CredentialsTreeItem>
{
  private _onDidChangeTreeData: CredentialEventEmitter = new EventEmitter();
  readonly onDidChangeTreeData: CredentialEvent =
    this._onDidChangeTreeData.event;

  constructor(private readonly _context: ExtensionContext) {}

  getTreeItem(element: CredentialsTreeItem): TreeItem | Thenable<TreeItem> {
    return element;
  }

  async getChildren(
    element: CredentialsTreeItem | undefined,
  ): Promise<CredentialsTreeItem[]> {
    if (element) {
      return [];
    }

    try {
      const api = await useApi();
      const response = await api.accounts.getAll();
      const result = response.data.map((account) => {
        return new CredentialsTreeItem(account);
      });
      await this.setContextIsEmpty(result.length === 0);
      return result;
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "credentials::getChildren",
        error,
      );
      window.showInformationMessage(summary);
      await this.setContextIsEmpty(true);
      return [];
    }
  }

  public refresh = () => {
    this._onDidChangeTreeData.fire();
  };

  public register() {
    this._context.subscriptions.push(
      window.createTreeView(viewName, { treeDataProvider: this }),
      commands.registerCommand(refreshCommand, this.refresh),
      commands.registerCommand(addCommand, this.add),
    );
  }

  private async setContextIsEmpty(isEmpty: boolean): Promise<void> {
    await commands.executeCommand(
      "setContext",
      contextIsEmpty,
      isEmpty ? "empty" : "notEmpty",
    );
  }

  public add = async () => {
    const name = await getServerNameFromInputBox();
    if (name === undefined) {
      return;
    }

    const url = await getServerUrlFromInputBox();
    if (url === undefined) {
      return;
    }

    const apiKey = await getApiKeyFromInputBox();
    if (apiKey === undefined) {
      return;
    }

    const api = await useApi();
    await api.credentials.createOrUpdate({
      name,
      url,
      apiKey,
    });

    // refresh the credentials view
    this.refresh();
  };
}

export class CredentialsTreeItem extends TreeItem {
  contextValue = "posit.publisher.credentials.tree.item";

  constructor(account: Account) {
    super(account.name);
    this.tooltip = this.getTooltip(account);
    this.iconPath = new ThemeIcon("key");
  }

  getTooltip(account: Account): string {
    let result = "";

    if (account.authType === "token-key") {
      result += `Account: ${account.accountName}\n`;
    } else if (account.authType === "api-key") {
      result += "Account: Using API Key\n";
    }

    result += `URL: ${account.url}\n`;
    result += `Managed by: ${account.source}`;

    return result;
  }
}

const getServerNameFromInputBox = async (): Promise<string | undefined> => {
  while (true) {
    let name = await window.showInputBox({
      title: "Enter the Server Name (1/3)",
      ignoreFocusOut: true,
    });
    if (name === undefined) {
      // user pressed escape
      return undefined;
    }
    name = name.trim();
    if (name === "") {
      window.showErrorMessage(`Server name is invalid. Found '${name}'`);
    } else {
      return name;
    }
  }
};

const getServerUrlFromInputBox = async (): Promise<string | undefined> => {
  while (true) {
    let url = await window.showInputBox({
      title: "Enter the Server URL (2/3)",
      ignoreFocusOut: true,
    });
    if (url === undefined) {
      // user pressed escape
      return undefined;
    }

    url = url.trim();
    if (url === "") {
      window.showErrorMessage(`Server URL not provided.`);
    } else {
      try {
        new URL(url);
      } catch (e) {
        if (!(e instanceof TypeError)) {
          throw e;
        }
        window.showErrorMessage(`Server URL format is invalid. Found '${url}'`);
      }
      return url;
    }
  }
};

const getApiKeyFromInputBox = async (): Promise<string | undefined> => {
  while (true) {
    let apiKey = await window.showInputBox({
      title: "Enter the API Key (3/3)",
      ignoreFocusOut: true,
    });
    if (apiKey === undefined) {
      // user pressed escape
      return undefined;
    }

    apiKey = apiKey.trim();
    if (apiKey === "") {
      window.showErrorMessage("API Key not provided.");
    } else if (apiKey.length !== 32) {
      window.showErrorMessage(
        `API Key format is invalid. Found '${apiKey}. Expected format 32 character string.`,
      );
    } else {
      return apiKey;
    }
  }
};
