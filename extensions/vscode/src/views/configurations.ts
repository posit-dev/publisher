import {
  Event,
  EventEmitter,
  ExtensionContext,
  FileSystemWatcher,
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
import {
  Configuration,
  ConfigurationDetails,
  ConfigurationError,
  isConfigurationError
} from "../api/types/configurations";

import { confirmDelete } from '../dialogs';
import { getSummaryStringFromError } from '../utils/errors';
import { untitledConfigurationName } from '../utils/names';

const viewName = 'posit.publisher.configurations';
const refreshCommand = viewName + '.refresh';
const addCommand = viewName + '.add';
const editCommand = viewName + '.edit';
const deleteCommand = viewName + '.delete';
const isEmptyContext = viewName + '.isEmpty';
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

    try {
      const response = await api.configurations.getAll();
      const configurations = response.data;
      commands.executeCommand('setContext', isEmptyContext, configurations.length === 0);

      return configurations.map(config => {
        const fileUri = Uri.joinPath(root.uri, config.configurationPath);
        return new ConfigurationTreeItem(config, fileUri);
      });
      } catch (error: unknown) {
        const summary = getSummaryStringFromError('configurations::getChildren', error);
        window.showInformationMessage(summary);
        commands.executeCommand('setContext', isEmptyContext, true);
        return [];
    }
  }

  public register(context: ExtensionContext) {
    context.subscriptions.push(window.registerTreeDataProvider(viewName, this));
    const treeView = window.createTreeView(viewName, { treeDataProvider: this });
    treeView.onDidChangeSelection(async e => {
      if (e.selection.length > 0) {
        const item = e.selection.at(0);
        await commands.executeCommand('posit.publisher.configurations.edit', item);
      }
    });

    context.subscriptions.push(
      treeView,
      commands.registerCommand(refreshCommand, this.refresh),
      commands.registerCommand(addCommand, this.add),
      commands.registerCommand(editCommand, this.edit),
      commands.registerCommand(deleteCommand, this.delete)
    );
    if (this.root !== undefined) {
      context.subscriptions.push(this.createFileSystemWatcher(this.root));
    }
  }

  private createFileSystemWatcher(root: WorkspaceFolder): FileSystemWatcher {
    const pattern = new RelativePattern(root, fileStore);
    const watcher = workspace.createFileSystemWatcher(pattern);
    watcher.onDidCreate(this.refresh);
    watcher.onDidDelete(this.refresh);
    watcher.onDidChange(this.refresh);
    return watcher;
  };

  private refresh = () => {
    this._onDidChangeTreeData.fire();
  };

  private add = async () => {
    try {
      const inspectResponse = await api.configurations.inspect();
      const config = await this.chooseConfig(inspectResponse.data);
      if (config === undefined) {
        // canceled
        return;
      }
      const defaultName = await untitledConfigurationName();
      const name = await window.showInputBox({
        value: defaultName,
        prompt: "Configuration name",
      });
      if (name === undefined || name === '') {
        // canceled
        return;
      }
      const createResponse = await api.configurations.createOrUpdate(name, config);
      if (this.root !== undefined) {
        const fileUri = Uri.file(createResponse.data.configurationPath);
        await commands.executeCommand('vscode.open', fileUri);
      }
    } catch (error: unknown) {
      const summary = getSummaryStringFromError('configurations::add', error);
      window.showInformationMessage(summary);
    }
  };

  private edit = async (config: ConfigurationTreeItem) => {
    await commands.executeCommand('vscode.open', config.fileUri);
  };

  private delete = async (item: ConfigurationTreeItem) => {
    const name = item.config.configurationName;
    const ok = await confirmDelete(`Are you sure you want to delete the configuration '${name}'?`);
    if (ok) {
      try {
        await api.configurations.delete(name);
      }  catch (error: unknown) {
        const summary = getSummaryStringFromError('configurations::delete', error);
        window.showInformationMessage(summary);
      }
    }
  };

  private chooseConfig = async (configs: ConfigurationDetails[]) => {
    if (configs.length === 1) {
      return configs[0];
    }
    const labels = configs.map(config => `${config.entrypoint} (type ${config.type})`);
    const labelMap = new Map<string, ConfigurationDetails>();
    for (let i = 0; i < configs.length; i++) {
      labelMap.set(labels[i], configs[i]);
    }

    const selection = await window.showQuickPick(labels, {
      title: "Select main file and type",
    });
    if (selection === undefined) {
      return undefined;
    }
    return labelMap.get(selection);
  };
}

export class ConfigurationTreeItem extends TreeItem {
  contextValue = 'posit.publisher.configurations.tree.item';

  constructor(
    public readonly config: Configuration | ConfigurationError,
    public readonly fileUri: Uri) {

    super(config.configurationName);

    if (isConfigurationError(config)) {
      this.iconPath = new ThemeIcon('warning' );
    }
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
