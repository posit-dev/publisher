// Copyright (C) 2024 by Posit Software, PBC.

import {
  Event,
  EventEmitter,
  ExtensionContext,
  InputBoxValidationSeverity,
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

    try {
      const api = await useApi();
      await api.credentials.createOrUpdate({
        name,
        url: url.toString(),
        apiKey,
      });
    } catch (error: unknown) {
      const summary = getSummaryStringFromError("credentials::add", error);
      window.showInformationMessage(summary);
    }

    // refresh the credentials view
    this.refresh();
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
  return window.showInputBox({
    title: "Enter the Credential Name (2/3)",
    placeHolder: "Posit Connect",
    prompt: "Choose a unique nickname for your credential.",
    value: value,
    ignoreFocusOut: true,
    validateInput: (input) => {
      input = input.trim();
      if (input.trim() === "") {
        return {
          message: "Oops! It seems like your forgot something.",
          severity: InputBoxValidationSeverity.Error,
        };
      }
      return;
    },
  });
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
  const format = (input: string): string => {
    // check if the URL starts with a scheme
    if (/^[a-zA-Z]+:\/\//.test(input)) {
      return input;
    }
    return `https://${input}`;
  };
  const url = await window.showInputBox({
    title: "Enter the Server URL (1/3)",
    placeHolder: "https://connect.example.com/",
    prompt:
      "The server URL is the web address you enter in your browser to access Posit Connect.",
    ignoreFocusOut: true,
    validateInput: (input) => {
      input = input.trim();
      if (input === "") {
        return {
          message: "Oops! It seems like your forgot something.",
          severity: InputBoxValidationSeverity.Error,
        };
      }
      try {
        // check if the URL starts with a scheme
        const url = new URL(format(input));
        if (!url.hostname.includes(".")) {
          return {
            message:
              "Hold up! You're missing a domain! Are you sure you want to proceed?",
            severity: InputBoxValidationSeverity.Warning,
          };
        }
      } catch (e) {
        if (!(e instanceof TypeError)) {
          throw e;
        }
        return {
          message: "Whoops! This URL isn't valid.",
          severity: InputBoxValidationSeverity.Error,
        };
      }
      return;
    },
  });
  return url !== undefined ? new URL(format(url)) : url;
};

/**
 * Get API key from user.
 *
 * Prompt the user with an input box for an API key. Retry until a valid API key is provided or the user quits.
 *
 * @returns Promise<string | undefined> - the API key, or undefined if user quits
 */
const getApiKeyFromInputBox = async (): Promise<string | undefined> => {
  return window.showInputBox({
    title: "Enter the API Key (3/3)",
    password: true,
    placeHolder: "ABcdEfgHIJKlMNopqRstuvWXyz012345",
    prompt:
      "An API key is a unique 32 character code that identifies and grants access to your server.",
    ignoreFocusOut: true,
    validateInput: (input) => {
      input = input.trim();
      if (input === "") {
        return "Oops! It looks like you forgot your API key.";
      } else if (input.length !== 32) {
        return "Hmm, the API key you entered doesn't match the secret 32-character code we were expecting. Please double-check it and try again!";
      }
      return;
    },
  });
};
