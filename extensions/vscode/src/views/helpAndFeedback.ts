import {
  TreeDataProvider,
  TreeItem,
  ProviderResult,
  ExtensionContext,
  window,
} from 'vscode';

const viewName = 'posit.publisher.helpAndFeedback';

export class HelpAndFeedbackTreeDataProvider implements TreeDataProvider<HelpAndFeedbackTreeItem> {

  constructor() { }

  getTreeItem(element: HelpAndFeedbackTreeItem): TreeItem | Thenable<TreeItem> {
    return element;
  }

  getChildren(element: HelpAndFeedbackTreeItem | undefined): ProviderResult<HelpAndFeedbackTreeItem[]> {
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

  public register(context: ExtensionContext) {
    window.registerTreeDataProvider(viewName, this);
    context.subscriptions.push(
      window.createTreeView(viewName, { treeDataProvider: this })
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

  contextValue = 'posit.publisher.helpAndFeedback.tree.item';
  tooltip = 'This is a \nHelpAndFeedback Tree Item';
}
