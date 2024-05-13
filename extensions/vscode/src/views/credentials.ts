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

import { useApi, Credential } from "src/api";
import { useBus } from "src/bus";
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

  constructor(private readonly _context: ExtensionContext) {
    useBus().on("refreshCredentials", () => {
      this._onDidChangeTreeData.fire();
    });
  }

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
      const response = await api.credentials.list();
      const creds = response.data.sort((a, b) => a.name.localeCompare(b.name));
      const result = creds.map((cred) => {
        return new CredentialsTreeItem(cred);
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

  public triggerRefresh = () => {
    // it's round-about, but we post a message on the bus so that
    // everyone will refresh their credentials, and on that message
    // then refresh ourselves from the API. This then allows everyone
    // to work the same to trigger a credential refresh.
    useBus().trigger("refreshCredentials", undefined);
  };

  public register() {
    this._context.subscriptions.push(
      window.createTreeView(viewName, { treeDataProvider: this }),
      commands.registerCommand(refreshCommand, this.triggerRefresh),
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
      this.triggerRefresh();
    }
  };

  public delete = async (item: CredentialsTreeItem) => {
    try {
      const api = await useApi();
      await api.credentials.delete(item.cred.guid);
      window.setStatusBarMessage(
        `Credential for ${item.cred.name} has been erased from our memory!`,
      );
    } catch (error: unknown) {
      const summary = getSummaryStringFromError("credential::delete", error);
      window.showInformationMessage(summary);
    }
    this.triggerRefresh();
  };
}

export class CredentialsTreeItem extends TreeItem {
  constructor(public readonly cred: Credential) {
    super(cred.name);
    this.iconPath = new ThemeIcon("key");
    this.description = `${cred.url}`;
    this.contextValue = `posit.publisher.credentials.tree.item.keychain`;
  }
}
