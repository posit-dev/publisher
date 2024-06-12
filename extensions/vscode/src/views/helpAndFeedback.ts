// Copyright (C) 2024 by Posit Software, PBC.

import { openUrl } from "src/utils/browser";
import {
  TreeDataProvider,
  TreeItem,
  ProviderResult,
  ExtensionContext,
  window,
  commands,
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
      commands.registerCommand(openGettingStartedCommand, async () => {
        await openUrl(
          "https://github.com/posit-dev/publisher/blob/main/docs/index.md",
          true,
        );
      }),
    );

    this._context.subscriptions.push(
      commands.registerCommand(openFeedbackCommand, async () => {
        await openUrl(
          "https://positpbc.slack.com/channels/publisher-feedback",
          true,
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
