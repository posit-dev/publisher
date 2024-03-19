// Copyright (C) 2024 by Posit Software, PBC.

import {
  Event,
  EventEmitter,
  ExtensionContext,
  ProviderResult,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  window
} from "vscode";

import {
  EventStream,
  EventStreamMessage,
  displayEventStreamMessage,
} from "../events";

enum LogStageStatus {
  notStarted,
  neverStarted,
  inProgress,
  completed,
  failed
}

type LogStage = {
  label: string,
  collapseState?: TreeItemCollapsibleState,
  status: LogStageStatus,
  stages: LogStage[],
  events: EventStreamMessage[]
};

type LogsTreeItem = LogsTreeStageItem | LogsTreeLogItem;

const createLogStage = (
  label: string,
  collapseState?: TreeItemCollapsibleState,
  status: LogStageStatus = LogStageStatus.notStarted,
  stages: LogStage[] = [],
  events: EventStreamMessage[] = [],
): LogStage => {
  return {
    label,
    collapseState,
    status,
    stages,
    events,
  };
};

const viewName = 'posit.publisher.logs';

/**
 * Tree data provider for the Logs view.
 */
export class LogsTreeDataProvider implements TreeDataProvider<LogsTreeItem> {
  private stages!: Map<string, LogStage>;
  private publishingStage!: LogStage;

  /**
   * Event emitter for when the tree data of the Logs view changes.
   * @private
   */
  private _onDidChangeTreeData: EventEmitter<LogsTreeItem | undefined> = new EventEmitter<LogsTreeItem | undefined>();

  /**
   * Creates an instance of LogsTreeDataProvider.
   * @constructor
   * @param {EventStream} stream - The event stream to listen to.
   */
  constructor(stream: EventStream) {
    // Initialize the stages map and the outer, publishing stage
    this.resetStages();

    // Register all of the events this view cares about
    this.registerEvents(stream);
  };

  private resetStages() {
    this.stages = new Map([
      ['publish/checkCapabilities', createLogStage('Check Capabilities')],
      ['publish/createBundle', createLogStage('Create Bundle')],
      ['publish/uploadBundle', createLogStage('Upload Bundle')],
      ['publish/createDeployment', createLogStage('Create Deployment')],
      ['publish/deployBundle', createLogStage('Deploy Bundle')],
      ['publish/restorePythonEnv', createLogStage('Restore Python Environment')],
      ['publish/runContent', createLogStage('Run Content')],
      ['publish/validateDeployment', createLogStage('Validate Deployment')],
    ]);

    this.publishingStage = createLogStage(
      'Publishing',
      TreeItemCollapsibleState.Expanded,
      LogStageStatus.notStarted,
      Array.from(this.stages.values())
    );
  }

  private registerEvents(stream: EventStream) {
    // Reset events when a new publish starts
    stream.register('publish/start', (msg: EventStreamMessage) => {
      this.resetStages();
      this.publishingStage.label = `Publishing to ${msg.data.server}`;
      this.publishingStage.status = LogStageStatus.inProgress;
      this.refresh();
    });

    stream.register('publish/success', (msg: EventStreamMessage) => {
      this.publishingStage.status = LogStageStatus.completed;
      this.publishingStage.events.push(msg);
      this.refresh();
    });
    
    stream.register('publish/failure', (msg: EventStreamMessage) => {
      this.publishingStage.status = LogStageStatus.failed;
      this.publishingStage.events.push(msg);
    
      this.stages.forEach((stage) => {
        if (stage.status === LogStageStatus.notStarted) {
          stage.status = LogStageStatus.neverStarted;
        }
      });

      window.showErrorMessage(`Publish failed. ${msg.data.message}`);
      this.refresh();
    });

    Array.from(this.stages.keys()).forEach((stageName) => {
      stream.register(`${stageName}/start`, (_: EventStreamMessage) => {
        const stage = this.stages.get(stageName);
        if (stage) {
          stage.status = LogStageStatus.inProgress;
        }
        this.refresh();
      });

      stream.register(`${stageName}/log`, (msg: EventStreamMessage) => {
        const stage = this.stages.get(stageName);
        if (stage && msg.data.level !== 'DEBUG') {
          stage.events.push(msg);
        }
        this.refresh();
      });

      stream.register(`${stageName}/success`, (_: EventStreamMessage) => {
        const stage = this.stages.get(stageName);
        if (stage) {
          stage.status = LogStageStatus.completed;
        }
        this.refresh();
      });

      stream.register(`${stageName}/failure`, (msg: EventStreamMessage) => {
        const stage = this.stages.get(stageName);
        if (stage) {
          stage.status = LogStageStatus.failed;
          stage.events.push(msg);
        }
        this.refresh();
      });
    });
  }

  /**
   * Get the event emitter for tree data changes.
   */
  get onDidChangeTreeData(): Event<LogsTreeItem | undefined> {
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
  getTreeItem(element: LogsTreeItem): TreeItem | Thenable<TreeItem> {
    return element;
  }

  /**
   * Get the child elements of the specified element.
   * @param _ The parent element.
   * @returns The child elements of the parent element.
   */
  getChildren(element?: LogsTreeItem): ProviderResult<Array<LogsTreeItem>> {
    if (element === undefined) {
      return [new LogsTreeStageItem(this.publishingStage)];
    }

    // Map the events array to LogsTreeItem instances and return them as children
    if (element instanceof LogsTreeStageItem) {
      const result = [];
      element.stages.forEach((stage: LogStage) => {
        result.push(new LogsTreeStageItem(stage));
      });
      result.push(...element.events.map(e => new LogsTreeLogItem(e)));
      return result;
    }

    return [];
  }

  /**
   * Register the tree view in the extension context.
   * @param context The extension context.
   */
  public register(context: ExtensionContext) {
    // Create a tree view with the specified view name and options
    context.subscriptions.push(
      window.createTreeView(viewName, {
        treeDataProvider: this
      })
    );
  }
}

export class LogsTreeStageItem extends TreeItem {
  stages: LogStage[] = [];
  events: EventStreamMessage[] = [];

  constructor(stage: LogStage) {
    let collapsibleState = stage.collapseState;
    if (collapsibleState === undefined) {
      collapsibleState = stage.events.length || stage.stages.length ?
        TreeItemCollapsibleState.Collapsed :
        TreeItemCollapsibleState.None;
    }

    super(stage.label, collapsibleState);

    this.stages = stage.stages;
    this.events = stage.events;
    this.setIcon(stage.status);
  }

  setIcon(status: LogStageStatus) {
    switch (status) {
      case LogStageStatus.notStarted:
        this.iconPath = new ThemeIcon('circle-large-outline');
        break;
      case LogStageStatus.neverStarted:
        this.iconPath = new ThemeIcon('circle-slash');
        break;
      case LogStageStatus.inProgress:
        this.iconPath = new ThemeIcon('loading~spin');
        break;
      case LogStageStatus.completed:
        this.iconPath = new ThemeIcon('check');
        break;
      case LogStageStatus.failed:
        this.iconPath = new ThemeIcon('error');
        break;
    }
  }
}

/**
 * Represents a tree item for displaying logs in the tree view.
 */
export class LogsTreeLogItem extends TreeItem {
  constructor(
    msg: EventStreamMessage,
    state: TreeItemCollapsibleState = TreeItemCollapsibleState.None
  ) {
    super(displayEventStreamMessage(msg), state);
    this.tooltip = JSON.stringify(msg);
  }
}
