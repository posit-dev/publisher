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
    const url = await getServerUrlFromInputBox();
    if (url === undefined) {
      return;
    }

    const name = await getServerNameFromInputBox(url.hostname);
    if (name === undefined) {
      return;
    }

    const apiKey = await getApiKeyFromInputBox();
    if (apiKey === undefined) {
      return;
    }

    const api = await useApi();
    await api.credentials.createOrUpdate({
      name,
      url: url.toString(),
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
    this.description = `${account.url}`;
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

/**
 * Get server name from user.
 *
 * Prompt the user via an input box for the server name (aka nickname, display name). Retry until a valid server name is provided.
 *
 * @param value default value (optional)
 * @returns the server name or undefined if the user escapes
 */
const getServerNameFromInputBox = async (
  value: string = "",
): Promise<string | undefined> => {
  let errorMessage = "";
  while (true) {
    let name = await window.showInputBox({
      title: "Enter the Credential Name (2/3)",
      placeHolder: errorMessage || "Posit Connect",
      prompt: "Choose a unique nickname for your credential.",
      value: errorMessage ? undefined : value,
      ignoreFocusOut: true,
    });
    if (name === undefined) {
      // user pressed escape
      return undefined;
    }
    name = name.trim();
    if (name === "") {
      errorMessage = `The provided credential nickname is invalid. Please try again.`;
      window.showErrorMessage(errorMessage);
    } else {
      return name;
    }
  }
};

/**
 * Get URL from user.
 *
 * Prompt the user with an input box for a url. Retry until a valid URL is provided or the user quits.
 *
 * Defaults the URL scheme to 'https://' (i.e., example.com -> https://example.com)
 *
 * @returns Promise<URL | undefined>
 */
const getServerUrlFromInputBox = async (): Promise<URL | undefined> => {
  let errorMessage = "";
  while (true) {
    let url = await window.showInputBox({
      title: "Enter the Server URL (1/3)",
      placeHolder: errorMessage || "https://connect.example.com/",
      prompt:
        "The server url is the web address where you access and interact with your deployed content, typically this is the address you access in your web browser.",
      ignoreFocusOut: true,
    });
    if (url === undefined) {
      // user pressed escape
      return undefined;
    }

    url = url.trim();
    if (url === "") {
      (errorMessage = `The provided server URL is invalid. Please try again.`),
        window.showErrorMessage(errorMessage);
    } else {
      try {
        // check if the URL starts with a scheme
        if (/^[a-zA-Z]+:\/\//.test(url)) {
          return new URL(url);
        } else {
          // default scheme to 'https://'
          return new URL(`https://${url}`);
        }
      } catch (e) {
        if (!(e instanceof TypeError)) {
          throw e;
        }
        (errorMessage = `The provided server URL '${url}' is invalid. Please try again.`),
          window.showErrorMessage(errorMessage);
        continue;
      }
    }
  }
};

/**
 * Get API key from user.
 *
 * Prompt the user with an input box for an API key. Retry until a valid API key is provided or the user quits.
 *
 * @returns Promise<string | undefined> - the API key, or undefined if user quits
 */
const getApiKeyFromInputBox = async (): Promise<string | undefined> => {
  let errorMessage;
  while (true) {
    let apiKey = await window.showInputBox({
      title: "Enter the API Key (3/3)",
      password: true,
      placeHolder: errorMessage || "ABcdEfgHIJKlMNopqRstuvWXyz012345",
      prompt:
        "An API key is a unique 32 character code that identifies and grants access to your server.",
      ignoreFocusOut: true,
    });

    if (apiKey === undefined) {
      // user pressed escape
      return undefined;
    }

    apiKey = apiKey.trim();
    if (apiKey === "") {
      errorMessage = "An API key was not provided. Please try again.";
      window.showErrorMessage(errorMessage);
    } else if (apiKey.length !== 32) {
      (errorMessage = `The provided API key is invalid. Expected a unique 32 character code. Please try again.`),
        window.showErrorMessage(errorMessage);
    } else {
      return apiKey;
    }
  }
};
