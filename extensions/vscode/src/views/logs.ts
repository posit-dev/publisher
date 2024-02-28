// Copyright (C) 2024 by Posit Software, PBC.

import * as vscode from 'vscode';

import { EventStream, EventStreamMessage, displayEventStreamMessage } from '../events';

enum LogStageStatus {
  notStarted,
  inProgress,
  completed,
  failed
}

type LogStage = {
  label: string,
  status: LogStageStatus,
  events: EventStreamMessage[]
};

const createLogStage = (
  label: string,
  status: LogStageStatus = LogStageStatus.notStarted,
  events: EventStreamMessage[] = [],
): LogStage => {
  return {
    label,
    status,
    events,
  };
};

const viewName = 'posit.publisher.logs';

/**
 * Tree data provider for the Logs view.
 */
export class LogsTreeDataProvider implements vscode.TreeDataProvider<LogsTreeStageItem | LogsTreeItem> {
  private stages!: Map<string, LogStage>;

  /**
   * Event emitter for when the tree data of the Logs view changes.
   * @private
   */
  private _onDidChangeTreeData: vscode.EventEmitter<LogsTreeStageItem | LogsTreeItem | undefined> = new vscode.EventEmitter<LogsTreeStageItem | LogsTreeItem | undefined>();

  /**
   * Creates an instance of LogsTreeDataProvider.
   * @constructor
   * @param {EventStream} stream - The event stream to listen to.
   */
  constructor(stream: EventStream) {
    // Initialize the stages map
    this.resetStages();

    // Register all of the events this view cares about
    this.registerEvents(stream);
  };

  private resetStages() {
    this.stages = new Map([
      ['publish/checkCapabilities', createLogStage('Check Capabilities')],
    ]);
  }

  private registerEvents(stream: EventStream) {
    // Reset events when a new publish starts
    stream.register('publish/start', (_: EventStreamMessage) => {
      this.resetStages();
    });

    stream.register('publish/checkCapabilities/start', (_: EventStreamMessage) => {
      const stage = this.stages.get('publish/checkCapabilities');
      if (stage) {
        stage.status = LogStageStatus.inProgress;
      }
      this.refresh();
    });

    stream.register('publish/checkCapabilities/log', (msg: EventStreamMessage) => {
      const stage = this.stages.get('publish/checkCapabilities');
      if (stage && msg.data.level !== 'DEBUG') {
        stage.events.push(msg);
      }
      this.refresh();
    });

    stream.register('publish/checkCapabilities/success', (_: EventStreamMessage) => {
      const stage = this.stages.get('publish/checkCapabilities');
      if (stage) {
        stage.status = LogStageStatus.completed;
      }
      this.refresh();
    });

    stream.register('publish/checkCapabilities/failure', (_: EventStreamMessage) => {
      const stage = this.stages.get('publish/checkCapabilities');
      if (stage) {
        stage.status = LogStageStatus.failed;
      }
      this.refresh();
    });
  }

  /**
   * Get the event emitter for tree data changes.
   */
  get onDidChangeTreeData(): vscode.Event<LogsTreeStageItem | LogsTreeItem | undefined> {
    return this._onDidChangeTreeData.event;
  }

  /**
   * Refresh the tree view by firing the onDidChangeTreeData event.
   */
  public refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Get the tree item for the specified element.
   * @param element The element for which to get the tree item.
   * @returns The tree item representing the element.
   */
  getTreeItem(element: LogsTreeStageItem | LogsTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  /**
   * Get the child elements of the specified element.
   * @param _ The parent element.
   * @returns The child elements of the parent element.
   */
  getChildren(element?: LogsTreeStageItem | LogsTreeItem): vscode.ProviderResult<Array<LogsTreeStageItem | LogsTreeItem>> {
    // Map the events array to LogsTreeItem instances and return them as children
    if (element instanceof LogsTreeStageItem) {
      const result = element.events.map(e => new LogsTreeItem(e));
      return result;
    }

    const result: LogsTreeStageItem[] = [];
    this.stages.forEach((stage: LogStage) => {
      result.push(new LogsTreeStageItem(stage, vscode.TreeItemCollapsibleState.Collapsed));
    });
    return result;
  }

  /**
   * Register the tree view in the extension context.
   * @param context The extension context.
   */
  public register(context: vscode.ExtensionContext) {
    // Register the tree data provider
    vscode.window.registerTreeDataProvider(viewName, this);
    // Create a tree view with the specified view name and options
    context.subscriptions.push(
      vscode.window.createTreeView(viewName, {
        treeDataProvider: this
      })
    );
  }
}

export class LogsTreeStageItem extends vscode.TreeItem {
  events: EventStreamMessage[] = [];

  constructor(stage: LogStage, state: vscode.TreeItemCollapsibleState) {
    super('Check Capabilities', state);
    this.events = stage.events;
    this.setIcon(stage.status);
  }

  setIcon(status: LogStageStatus) {
    switch (status) {
      case LogStageStatus.notStarted:
        this.iconPath = new vscode.ThemeIcon('circle-outline');
        break;
      case LogStageStatus.inProgress:
        this.iconPath = new vscode.ThemeIcon('loading~spin');
        break;
      case LogStageStatus.completed:
        this.iconPath = new vscode.ThemeIcon('check');
        break;
      case LogStageStatus.failed:
        this.iconPath = new vscode.ThemeIcon('error');
        break;
    }
  }
}

/**
 * Represents a tree item for displaying logs in the tree view.
 */
export class LogsTreeItem extends vscode.TreeItem {
  constructor(
    msg: EventStreamMessage,
    state: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
  ) {
    super(displayEventStreamMessage(msg), state);
    this.tooltip = JSON.stringify(msg);
  }
}
