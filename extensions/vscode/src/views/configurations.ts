import {
  Event,
  EventEmitter,
  ExtensionContext,
  RelativePattern,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  Uri,
  WorkspaceFolder,
  commands,
  window,
  workspace,
} from 'vscode';

import api from '../api';
import { isConfigurationError } from "../api/types/configurations";
import { confirmDelete } from './confirm';

const viewName = 'posit.publisher.configurations';
// const addCommand = viewName + '.add';
const editCommand = viewName + '.edit';
const deleteCommand = viewName + '.delete';
const fileStore = '.posit/publish/*.toml';

type ConfigurationEventEmitter = EventEmitter<ConfigurationTreeItem | undefined | void>;
type ConfigurationEvent = Event<ConfigurationTreeItem | undefined | void>;

export class ConfigurationsTreeDataProvider implements TreeDataProvider<ConfigurationTreeItem> {
  private root: WorkspaceFolder | undefined;
  private _onDidChangeTreeData: ConfigurationEventEmitter = new EventEmitter();
  readonly onDidChangeTreeData: ConfigurationEvent = this._onDidChangeTreeData.event;

  constructor() {
    const workspaceFolders = workspace.workspaceFolders;
    if (workspaceFolders !== undefined) {
      this.root = workspaceFolders[0];
    }
  }

  refresh(): void {
    console.log("refreshing configurations");
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ConfigurationTreeItem): TreeItem | Thenable<TreeItem> {
    return element;
  }

  async getChildren(element: ConfigurationTreeItem | undefined): Promise<ConfigurationTreeItem[]> {
    if (element) {
      // Config elements have no children.
      return [];
    }
    const root = this.root;
    if (root === undefined) {
      // There can't be any configurations if we don't have a folder open.
      return [];
    }
    const response = await api.configurations.getAll();
    return response.data.map(config => {
      const fileUri = Uri.joinPath(root.uri, config.configurationPath);
      return new ConfigurationTreeItem(config.configurationName, fileUri, isConfigurationError(config));
    });
  }

  public register(context: ExtensionContext) {
    window.registerTreeDataProvider(viewName, this);
    context.subscriptions.push(
      window.createTreeView(viewName, { treeDataProvider: this })
    );
    context.subscriptions.push(
      commands.registerCommand(editCommand, async (config: ConfigurationTreeItem) => {
        await commands.executeCommand('vscode.open', config.fileUri);
      })
    );
    context.subscriptions.push(
      commands.registerCommand(deleteCommand, async (config: ConfigurationTreeItem) => {
        const ok = await confirmDelete(`Are you sure you want to delete the configuration '${config.name}'?`);
        if (ok) {
          await api.configurations.delete(config.name);
        }
      })
    );
    if (this.root !== undefined) {
      console.log("creating filesystem watcher for configurations view");
      const watcher = workspace.createFileSystemWatcher(
        new RelativePattern(this.root, fileStore));
      watcher.onDidCreate(_ => {
        this.refresh();
      });
      watcher.onDidDelete(_ => {
        this.refresh();
      });
      watcher.onDidChange(_ => {
        this.refresh();
      });
      context.subscriptions.push(watcher);
    }
  }
}

export class ConfigurationTreeItem extends TreeItem {
  constructor(
    public readonly name: string,
    public readonly fileUri: Uri,
    public readonly isError: boolean) {

    super(name);
    const iconName = isError ? 'warning' : 'gear';
    this.iconPath = new ThemeIcon(iconName);
  }

  contextValue = 'posit.publisher.configurations.tree.item';
  tooltip = 'This is a \nConfigurations Tree Item';
}
