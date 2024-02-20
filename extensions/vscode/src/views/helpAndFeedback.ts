import * as vscode from 'vscode';

const viewName = 'posit.publisher.helpAndFeedback.provider';

export class HelpAndFeedbackTreeDataProvider implements vscode.TreeDataProvider<HelpAndFeedbackTreeItem> {

  constructor() { }

  getTreeItem(element: HelpAndFeedbackTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  getChildren(element: HelpAndFeedbackTreeItem | undefined): vscode.ProviderResult<HelpAndFeedbackTreeItem[]> {
    if (element === undefined) {
      return [
        new HelpAndFeedbackTreeItem('Read Extension Documentation', 'Open Extension Documentation', 'posit.publisher.helpAndFeedback.command.openExtensionDoc'),
        new HelpAndFeedbackTreeItem('Get Started with Posit Publisher', 'Open Get Started Documentation', 'posit.publisher.helpAndFeedback.command.openGetStartedDoc'),
        new HelpAndFeedbackTreeItem('Review Issues', 'Open Posit Publisher Issues', 'posit.publisher.helpAndFeedback.command.openIssues'),
        new HelpAndFeedbackTreeItem('Report Issue', 'Report a Posit Publisher Issue', 'posit.publisher.helpAndFeedback.command.openNewIssue'),
      ];
    }
    return [];
  }

  getParent?(element: HelpAndFeedbackTreeItem): vscode.ProviderResult<HelpAndFeedbackTreeItem> {
    return element;
  }

  resolveTreeItem?(_1: vscode.TreeItem, _2: HelpAndFeedbackTreeItem, _3: vscode.CancellationToken): vscode.ProviderResult<HelpAndFeedbackTreeItem> {
    throw new Error('Method not implemented.');
  }

  public register(context: vscode.ExtensionContext): any {
    vscode.window.registerTreeDataProvider(viewName, this);
    context.subscriptions.push(
      vscode.window.createTreeView(viewName, { treeDataProvider: this })
    );
  }
}

export class HelpAndFeedbackTreeItem extends vscode.TreeItem {

  constructor(itemString: string, commandTitle: string, command: string) {
    super(itemString);
    this.command = {
      title: commandTitle,
      command,
    };
  }

  contextValue = 'posit.publisher.helpAndFeedback.tree.item';
  tooltip = 'This is a \nHelpAndFeedback Tree Item';
}
