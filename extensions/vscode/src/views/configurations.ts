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
import { Configuration, ConfigurationError, isConfigurationError } from "../api/types/configurations";
import { confirmDelete } from '../dialogs';
import { notify } from '../notify';

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

  public refresh = (notifyUser: boolean) => {
    console.log("refreshing configurations");
    if (notifyUser) {
      notify('refreshing configurations...');
    }
    this._onDidChangeTreeData.fire();
  };

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
      return new ConfigurationTreeItem(config, fileUri);
    });
  }

  public register(context: ExtensionContext) {
    window.registerTreeDataProvider(viewName, this);
    const treeView = window.createTreeView(viewName, { treeDataProvider: this });
    treeView.onDidChangeSelection(async e => {
      console.log(e);
      if (e.selection.length > 0) {
        const item = e.selection.at(0);
        await commands.executeCommand('posit.publisher.configurations.edit', item);
      }
    });
    context.subscriptions.push(treeView);

    context.subscriptions.push(
      commands.registerCommand(editCommand, async (item: ConfigurationTreeItem) => {
        await commands.executeCommand('vscode.open', item.fileUri);
      })
    );
    context.subscriptions.push(
      commands.registerCommand(deleteCommand, async (item: ConfigurationTreeItem) => {
        const ok = await confirmDelete(`Are you sure you want to delete the configuration '${item.config.configurationName}'?`);
        if (ok) {
          notify('deleting configuration...');
          await api.configurations.delete(item.config.configurationName);
        }
      })
    );
    if (this.root !== undefined) {
      console.log("creating filesystem watcher for configurations view");
      const watcher = workspace.createFileSystemWatcher(
        new RelativePattern(this.root, fileStore));
      watcher.onDidCreate(() => this.refresh(false));
      watcher.onDidDelete(() => this.refresh(false));
      watcher.onDidChange(() => this.refresh(false));
      context.subscriptions.push(watcher);
    }
  }
}

export class ConfigurationTreeItem extends TreeItem {
  contextValue = 'posit.publisher.configurations.tree.item';

  constructor(
    public readonly config: Configuration | ConfigurationError,
    public readonly fileUri: Uri) {

    super(config.configurationName);

    const iconName = isConfigurationError(config) ? 'warning' : 'gear';
    this.iconPath = new ThemeIcon(iconName);
    this.tooltip = this.getTooltip();
  }

  getTooltip(): string {
    let tooltip: string;

    if (isConfigurationError(this.config)) {
      tooltip = "This configuration file is invalid. Click to open it and resolve the underlined errors.";
    } else {
      const c = this.config.configuration;

      tooltip = `Title: ${c.title}\nFile: ${c.entrypoint}\nType: ${c.type}`;
      const pyVersion = c.python?.version;
      if (pyVersion) {
        tooltip += `\nPython: ${pyVersion}`;
      }
      const rVersion = c.r?.version;
      if (rVersion) {
        tooltip += `\R: ${rVersion}`;
      }
    }
    return tooltip;
  }
}
