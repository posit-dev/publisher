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
  collapseState?: vscode.TreeItemCollapsibleState,
  status: LogStageStatus,
  stages: LogStage[],
  events: EventStreamMessage[]
};

type LogsTreeItem = LogsTreeStageItem | LogsTreeLogItem;

const createLogStage = (
  label: string,
  collapseState?: vscode.TreeItemCollapsibleState,
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
export class LogsTreeDataProvider implements vscode.TreeDataProvider<LogsTreeItem> {
  private outsideStage!: LogStage;
  private stages!: Map<string, LogStage>;
  private successEvents : EventStreamMessage[] = [];

  /**
   * Event emitter for when the tree data of the Logs view changes.
   * @private
   */
  private _onDidChangeTreeData: vscode.EventEmitter<LogsTreeItem | undefined> = new vscode.EventEmitter<LogsTreeItem | undefined>();

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
    this.outsideStage = createLogStage('Publishing', vscode.TreeItemCollapsibleState.Expanded);

    this.stages = new Map([
      ['publish/checkCapabilities', createLogStage('Check Capabilities')],
      ['publish/createBundle', createLogStage('Create Bundle')],
      ['publish/uploadBundle', createLogStage('Upload Bundle')],
      ['publish/createDeployment', createLogStage('Create Deployment')],
      ['publish/deployBundle', createLogStage('Deploy Bundle')],
      ['publish/restorePythonEnv', createLogStage('Restore Python Environment')],
      ['publish/runContent', createLogStage('Run Content')],
    ]);
    this.outsideStage.stages = Array.from(this.stages.values());
    this.successEvents = [];
    this.outsideStage.events = this.successEvents;
  }

  private registerEvents(stream: EventStream) {
    // Reset events when a new publish starts
    stream.register('publish/start', (_: EventStreamMessage) => {
      this.resetStages();
      this.outsideStage.status = LogStageStatus.inProgress;
      this.refresh();
    });

    this.registerCheckCapabilitiesEvents(stream);
    this.registerCreateBundleEvents(stream);
    this.registerUploadBundleEvents(stream);
    this.registerCreateDeploymentEvents(stream);
    this.registerDeployBundleEvents(stream);
    this.registerRestorePythonEnvEvents(stream);
    this.registerRunContentEvents(stream);

    stream.register('publish/success', (msg: EventStreamMessage) => {
      this.outsideStage.status = LogStageStatus.completed;
      this.successEvents.push(msg);
      this.refresh();
    });
  }

  registerCheckCapabilitiesEvents(stream: EventStream) {
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

  registerCreateBundleEvents(stream: EventStream) {
    stream.register('publish/createBundle/start', (_: EventStreamMessage) => {
      const stage = this.stages.get('publish/createBundle');
      if (stage) {
        stage.status = LogStageStatus.inProgress;
      }
      this.refresh();
    });

    stream.register('publish/createBundle/log', (msg: EventStreamMessage) => {
      const stage = this.stages.get('publish/createBundle');
      if (stage && msg.data.level !== 'DEBUG') {
        stage.events.push(msg);
      }
      this.refresh();
    });

    stream.register('publish/createBundle/success', (_: EventStreamMessage) => {
      const stage = this.stages.get('publish/createBundle');
      if (stage) {
        stage.status = LogStageStatus.completed;
      }
      this.refresh();
    });

    stream.register('publish/createBundle/failure', (_: EventStreamMessage) => {
      const stage = this.stages.get('publish/createBundle');
      if (stage) {
        stage.status = LogStageStatus.failed;
      }
      this.refresh();
    });
  }

  registerUploadBundleEvents(stream: EventStream) {
    stream.register('publish/uploadBundle/start', (_: EventStreamMessage) => {
      const stage = this.stages.get('publish/uploadBundle');
      if (stage) {
        stage.status = LogStageStatus.inProgress;
      }
      this.refresh();
    });

    stream.register('publish/uploadBundle/log', (msg: EventStreamMessage) => {
      const stage = this.stages.get('publish/uploadBundle');
      if (stage && msg.data.level !== 'DEBUG') {
        stage.events.push(msg);
      }
      this.refresh();
    });

    stream.register('publish/uploadBundle/success', (_: EventStreamMessage) => {
      const stage = this.stages.get('publish/uploadBundle');
      if (stage) {
        stage.status = LogStageStatus.completed;
      }
      this.refresh();
    });

    stream.register('publish/uploadBundle/failure', (_: EventStreamMessage) => {
      const stage = this.stages.get('publish/uploadBundle');
      if (stage) {
        stage.status = LogStageStatus.failed;
      }
      this.refresh();
    });
  }

  registerCreateDeploymentEvents(stream: EventStream) {
    stream.register('publish/createDeployment/start', (_: EventStreamMessage) => {
      const stage = this.stages.get('publish/createDeployment');
      if (stage) {
        stage.status = LogStageStatus.inProgress;
      }
      this.refresh();
    });
    stream.register('publish/createDeployment/log', (msg: EventStreamMessage) => {
      const stage = this.stages.get('publish/createDeployment');
      if (stage && msg.data.level !== 'DEBUG') {
        stage.events.push(msg);
      }
      this.refresh();
    });
    stream.register('publish/createDeployment/success', (_: EventStreamMessage) => {
      const stage = this.stages.get('publish/createDeployment');
      if (stage) {
        stage.status = LogStageStatus.completed;
      }
      this.refresh();
    });
    stream.register('publish/createDeployment/failure', (_: EventStreamMessage) => {
      const stage = this.stages.get('publish/createDeployment');
      if (stage) {
        stage.status = LogStageStatus.failed;
      }
      this.refresh();
    });
  }

  registerDeployBundleEvents(stream: EventStream) {
    stream.register('publish/deployBundle/start', (_: EventStreamMessage) => {
      const stage = this.stages.get('publish/deployBundle');
      if (stage) {
        stage.status = LogStageStatus.inProgress;
      }
      this.refresh();
    });
    stream.register('publish/deployBundle/log', (msg: EventStreamMessage) => {
      const stage = this.stages.get('publish/deployBundle');
      if (stage && msg.data.level !== 'DEBUG') {
        stage.events.push(msg);
      }
      this.refresh();
    });
    stream.register('publish/deployBundle/success', (_: EventStreamMessage) => {
      const stage = this.stages.get('publish/deployBundle');
      if (stage) {
        stage.status = LogStageStatus.completed;
      }
      this.refresh();
    });
    stream.register('publish/deployBundle/failure', (_: EventStreamMessage) => {
      const stage = this.stages.get('publish/deployBundle');
      if (stage) {
        stage.status = LogStageStatus.failed;
      }
      this.refresh();
    });
  }

  registerRestorePythonEnvEvents(stream: EventStream) {
    stream.register('publish/restorePythonEnv/start', (_: EventStreamMessage) => {
      const stage = this.stages.get('publish/restorePythonEnv');
      if (stage) {
        stage.status = LogStageStatus.inProgress;
      }
      this.refresh();
    });
    stream.register('publish/restorePythonEnv/log', (msg: EventStreamMessage) => {
      const stage = this.stages.get('publish/restorePythonEnv');
      if (stage && msg.data.level !== 'DEBUG') {
        stage.events.push(msg);
      }
      this.refresh();
    });
    stream.register('publish/restorePythonEnv/success', (_: EventStreamMessage) => {
      const stage = this.stages.get('publish/restorePythonEnv');
      if (stage) {
        stage.status = LogStageStatus.completed;
      }
      this.refresh();
    });
    stream.register('publish/restorePythonEnv/failure', (_: EventStreamMessage) => {
      const stage = this.stages.get('publish/restorePythonEnv');
      if (stage) {
        stage.status = LogStageStatus.failed;
      }
      this.refresh();
    });
  }

  registerRunContentEvents(stream: EventStream) {
    stream.register('publish/runContent/start', (_: EventStreamMessage) => {
      const stage = this.stages.get('publish/runContent');
      if (stage) {
        stage.status = LogStageStatus.inProgress;
      }
      this.refresh();
    });
    stream.register('publish/runContent/log', (msg: EventStreamMessage) => {
      const stage = this.stages.get('publish/runContent');
      if (stage && msg.data.level !== 'DEBUG') {
        stage.events.push(msg);
      }
      this.refresh();
    });
    stream.register('publish/runContent/success', (_: EventStreamMessage) => {
      const stage = this.stages.get('publish/runContent');
      if (stage) {
        stage.status = LogStageStatus.completed;
      }
      this.refresh();
    });
    stream.register('publish/runContent/failure', (_: EventStreamMessage) => {
      const stage = this.stages.get('publish/runContent');
      if (stage) {
        stage.status = LogStageStatus.failed;
      }
      this.refresh();
    });
  }

  /**
   * Get the event emitter for tree data changes.
   */
  get onDidChangeTreeData(): vscode.Event<LogsTreeItem | undefined> {
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
  getTreeItem(element: LogsTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  /**
   * Get the child elements of the specified element.
   * @param _ The parent element.
   * @returns The child elements of the parent element.
   */
  getChildren(element?: LogsTreeItem): vscode.ProviderResult<Array<LogsTreeItem>> {
    if (element === undefined) {
      return [new LogsTreeStageItem(this.outsideStage)];
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

    const result: LogsTreeItem[] = [];
    this.stages.forEach((stage: LogStage) => {
      result.push(new LogsTreeStageItem(stage));
    });

    if (this.successEvents.length > 0) {
      result.push(
        ...this.successEvents.map(event => new LogsTreeLogItem(event, vscode.TreeItemCollapsibleState.None))
      );
    };

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
  stages: LogStage[] = [];
  events: EventStreamMessage[] = [];

  constructor(stage: LogStage) {
    let collapsibleState = stage.collapseState;
    if (collapsibleState === undefined) {
      collapsibleState = stage.events.length || stage.stages.length ?
        vscode.TreeItemCollapsibleState.Collapsed :
        vscode.TreeItemCollapsibleState.None;
    }

    super(stage.label, collapsibleState);

    this.stages = stage.stages;
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
export class LogsTreeLogItem extends vscode.TreeItem {
  constructor(
    msg: EventStreamMessage,
    state: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
  ) {
    super(displayEventStreamMessage(msg), state);
    this.tooltip = JSON.stringify(msg);
  }
}
