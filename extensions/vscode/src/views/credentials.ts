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
import { newCredential } from "src/multiStepInputs/newCredential";

const viewName = "posit.publisher.credentials";
const refreshCommand = viewName + ".refresh";
const contextIsEmpty = viewName + ".isEmpty";
const addCommand = viewName + ".add";
const deleteCommand = viewName + ".delete";

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
      commands.registerCommand(deleteCommand, this.delete),
    );
  }

  private async setContextIsEmpty(isEmpty: boolean): Promise<void> {
    await commands.executeCommand(
      "setContext",
      contextIsEmpty,
      isEmpty ? "empty" : "notEmpty",
    );
  }

  /**
   * Add credential.
   *
   * Prompt the user for credential information. Then create or update the credential. Afterwards, refresh the provider.
   *
   * Once the server url is provided, the user is prompted with the url hostname as the default server name.
   *
   * @returns
   */
  public add = async () => {
    const credential = await newCredential();
    if (credential) {
      // refresh the credentials view
      this.refresh();
    }
  };

  public delete = async (item: CredentialsTreeItem) => {
    try {
      const api = await useApi();
      await api.credentials.delete(item.account.name);
      window.setStatusBarMessage(
        `Credential for ${item.account.name} has been erased from our memory!`,
      );
    } catch (error: unknown) {
      const summary = getSummaryStringFromError("credential::delete", error);
      window.showInformationMessage(summary);
    }
    this.refresh();
  };
}

export class CredentialsTreeItem extends TreeItem {
  constructor(public readonly account: Account) {
    super(account.name);
    this.tooltip = this.getTooltip(account);
    this.iconPath = new ThemeIcon("key");
    this.description = `${account.url}`;
    this.contextValue = `posit.publisher.credentials.tree.item.${account.source}`;
  }

  getTooltip(account: Account): string {
    let result = "";

    if (account.authType === "token-key") {
      result += `Account: ${account.accountName}\n`;
    }

    result += `Managed by: ${account.source}`;

    return result;
  }
}
