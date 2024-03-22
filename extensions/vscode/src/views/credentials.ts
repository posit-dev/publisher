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

import api, { Account } from "../api";
import { getSummaryStringFromError } from "../utils/errors";

const viewName = "posit.publisher.credentials";
const refreshCommand = viewName + ".refresh";
const contextIsEmpty = viewName + ".isEmpty";

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

  constructor() {}

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
      let result: CredentialsTreeItem[] = [];
      await this.setContextIsEmpty(true);
      const response = await api.accounts.getAll();
      const accounts = response.data.accounts;
      if (accounts) {
        result = accounts.map((account) => {
          return new CredentialsTreeItem(account);
        });
        await this.setContextIsEmpty(result.length === 0);
      }
      return result;
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "credentials::getChildren",
        error,
      );
      window.showInformationMessage(summary);
      return [];
    }
  }

  public refresh = () => {
    this._onDidChangeTreeData.fire();
  };

  public register(context: ExtensionContext) {
    context.subscriptions.push(
      window.createTreeView(viewName, { treeDataProvider: this }),
    );

    context.subscriptions.push(
      commands.registerCommand(refreshCommand, this.refresh),
    );
  }

  private async setContextIsEmpty(isEmpty: boolean): Promise<void> {
    await commands.executeCommand(
      "setContext",
      contextIsEmpty,
      isEmpty ? "empty" : "notEmpty",
    );
  }
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
