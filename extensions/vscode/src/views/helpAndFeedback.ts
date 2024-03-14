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
} from 'vscode';

const viewName = 'posit.publisher.helpAndFeedback';
const openExtensionDocCommand = viewName + '.openExtensionDoc';
const openGettingStartedCommand = viewName + '.gettingStarted';
const openFeatureOverviewCommand = viewName + '.featureOverview';
const openFeedbackCommand = viewName + 'openFeedback';

export class HelpAndFeedbackTreeDataProvider implements TreeDataProvider<HelpAndFeedbackTreeItem> {

  constructor() { }

  getTreeItem(element: HelpAndFeedbackTreeItem): TreeItem | Thenable<TreeItem> {
    return element;
  }

  getChildren(element: HelpAndFeedbackTreeItem | undefined): ProviderResult<HelpAndFeedbackTreeItem[]> {
    if (element === undefined) {
      return [
        new HelpAndFeedbackTreeItem(
          'Read Extension Documentation',
          'Open Extension Documentation',
          openExtensionDocCommand,
        ),
        new HelpAndFeedbackTreeItem(
          'Get Started with Posit Publisher',
          'Open Get Started Documentation',
          openGettingStartedCommand,
        ),
        new HelpAndFeedbackTreeItem(
          'Feature Overview',
          'Open Featue Overview',
          openFeatureOverviewCommand,
        ),
        new HelpAndFeedbackTreeItem(
          'Report Feedback',
          'Open Feedback Slack Channel',
          openFeedbackCommand,
        ),
      ];
    }
    return [];
  }

  public register(context: ExtensionContext) {
    window.registerTreeDataProvider(viewName, this);
    context.subscriptions.push(
      window.createTreeView(viewName, { treeDataProvider: this })
    );

    context.subscriptions.push(
      commands.registerCommand(openExtensionDocCommand, () => {
        env.openExternal(Uri.parse('https://github.com/posit-dev/publisher/blob/806ee91f2ffe881ff43d6d8b472ad48b481c11ec/docs/vscode.md'));
      })
    );

    context.subscriptions.push(
      commands.registerCommand(openGettingStartedCommand, () => {
        env.openExternal(Uri.parse('https://github.com/posit-dev/publisher/blob/mm-alpha3-docs/docs/vscode.md#tutorial'));
      })
    );

    context.subscriptions.push(
      commands.registerCommand(openFeatureOverviewCommand, () => {
        env.openExternal(Uri.parse('https://github.com/posit-dev/publisher/wiki/Feature-Overview'));
      })
    );
    context.subscriptions.push(
      commands.registerCommand(openFeedbackCommand, () => {
        env.openExternal(Uri.parse('https://positpbc.slack.com/channels/publisher-feedback'));
      })
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