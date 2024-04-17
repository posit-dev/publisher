// Copyright (C) 2024 by Posit Software, PBC.

import {
  TreeDataProvider,
  TreeItem,
  ProviderResult,
  ExtensionContext,
  window,
  Uri,
  commands,
  env,
} from "vscode";

const viewName = "posit.publisher.helpAndFeedback";
const openGettingStartedCommand = viewName + ".gettingStarted";
const openFeedbackCommand = viewName + "openFeedback";

export class HelpAndFeedbackTreeDataProvider
  implements TreeDataProvider<HelpAndFeedbackTreeItem>
{
  constructor(private readonly _context: ExtensionContext) {}

  getTreeItem(element: HelpAndFeedbackTreeItem): TreeItem | Thenable<TreeItem> {
    return element;
  }

  getChildren(
    element: HelpAndFeedbackTreeItem | undefined,
  ): ProviderResult<HelpAndFeedbackTreeItem[]> {
    if (element === undefined) {
      return [
        new HelpAndFeedbackTreeItem(
          "Get Started with Posit Publisher",
          "Open Getting Started Documentation",
          openGettingStartedCommand,
        ),
        new HelpAndFeedbackTreeItem(
          "Provide Feedback",
          "Open Feedback Slack Channel",
          openFeedbackCommand,
        ),
      ];
    }
    return [];
  }

  public register() {
    this._context.subscriptions.push(
      window.createTreeView(viewName, { treeDataProvider: this }),
    );

    this._context.subscriptions.push(
      commands.registerCommand(openGettingStartedCommand, () => {
        env.openExternal(
          Uri.parse(
            "https://github.com/posit-dev/publisher/blob/e72828f3585497649b8b55470a665f7fa890a21f/docs/vscode.md",
          ),
        );
      }),
    );

    this._context.subscriptions.push(
      commands.registerCommand(openFeedbackCommand, () => {
        env.openExternal(
          Uri.parse("https://positpbc.slack.com/channels/publisher-feedback"),
        );
      }),
    );
  }
}

export class HelpAndFeedbackTreeItem extends TreeItem {
  constructor(itemString: string, commandTitle: string, command: string) {
    super(itemString);
    this.command = {
      title: commandTitle,
      command,
    };
  }
}
