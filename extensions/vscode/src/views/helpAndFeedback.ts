// Copyright (C) 2024 by Posit Software, PBC.

import { Commands, Views } from "src/constants";
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
          Commands.HelpOpenGettingStarted,
        ),
        new HelpAndFeedbackTreeItem(
          "Provide Feedback",
          "Open Feedback Slack Channel",
          Commands.HelpOpenGettingStarted,
        ),
      ];
    }
    return [];
  }

  public register() {
    this._context.subscriptions.push(
      window.createTreeView(Views.HelpAndFeedback, { treeDataProvider: this }),
    );

    this._context.subscriptions.push(
      commands.registerCommand(Commands.HelpOpenGettingStarted, () => {
        env.openExternal(
          Uri.parse(
            "https://github.com/posit-dev/publisher/blob/main/docs/index.md",
          ),
        );
      }),
    );

    this._context.subscriptions.push(
      commands.registerCommand(Commands.HelpOpenFeedback, () => {
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
