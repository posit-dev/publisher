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

import {
  alert,
  confirmDelete
} from '../dialogs';

const viewName = 'posit.publisher.configurations';
const addCommand = viewName + '.add';
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
      if (e.selection.length > 0) {
          const item = e.selection.at(0);
          await commands.executeCommand('posit.publisher.configurations.edit', item);
        }
    });
    context.subscriptions.push(treeView);

    context.subscriptions.push(commands.registerCommand(addCommand, this.add));
    context.subscriptions.push(commands.registerCommand(editCommand, this.edit));
    context.subscriptions.push(commands.registerCommand(deleteCommand, this.delete));
    if (this.root !== undefined) {
      context.subscriptions.push(this.createFileSystemWatcher(this.root));
    }
  }

  private createFileSystemWatcher(root: WorkspaceFolder): FileSystemWatcher {
    console.log("creating filesystem watcher for configurations view");
    const pattern = new RelativePattern(root, fileStore);
    const watcher = workspace.createFileSystemWatcher(pattern);
    watcher.onDidCreate(this.refresh);
    watcher.onDidDelete(this.refresh);
    watcher.onDidChange(this.refresh);
    return watcher;
  };

  private refresh = () => {
    console.log("refreshing configurations");
    this._onDidChangeTreeData.fire();
  };

  private add = async () => {
    const inspectResponse = await api.configurations.inspect();
    if (inspectResponse.status !== 200) {
      alert("An error occurred while inspecting the project: " + inspectResponse.statusText);
      return;
    }
    const config = await this.chooseConfig(inspectResponse.data);
    if (config === undefined) {
      // canceled
      return;
    }
    const defaultName = await api.configurations.untitledConfigurationName();
    const name = await window.showInputBox({
      value: defaultName,
      prompt: "Configuration name",
    });
    if (name === undefined || name === '') {
      // canceled
      return;
    }
    const createResponse = await api.configurations.createOrUpdate(name, config);
    if (createResponse.status !== 200) {
      alert("An error occurred while saving the configuration: " + createResponse.statusText);
      return;
    }
    if (this.root !== undefined) {
      const fileUri = Uri.file(createResponse.data.configurationPath);
      await commands.executeCommand('vscode.open', fileUri);
    }
  };

  private edit = async (config: ConfigurationTreeItem) => {
    await commands.executeCommand('vscode.open', config.fileUri);
  };

  private delete = async (item: ConfigurationTreeItem) => {
    const name = item.config.configurationName;
    const ok = await confirmDelete(`Are you sure you want to delete the configuration '${name}'?`);
    if (ok) {
      await api.configurations.delete(name);
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

    const iconName = isConfigurationError(config) ? 'warning' : 'gear';
    this.iconPath = new ThemeIcon(iconName);
    this.tooltip = this.getTooltip();
  }

  getTooltip(): string{
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
