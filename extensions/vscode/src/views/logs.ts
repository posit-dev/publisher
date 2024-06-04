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
  Uri,
  commands,
  env,
  window,
} from "vscode";

import { EventStream, displayEventStreamMessage } from "src/events";

import { EventStreamMessage } from "src/api";

enum LogStageStatus {
  notStarted,
  neverStarted,
  skipped,
  inProgress,
  completed,
  failed,
}

type LogStage = {
  inactiveLabel: string;
  activeLabel: string;
  alternatePaths?: string[];
  collapseState?: TreeItemCollapsibleState;
  status: LogStageStatus;
  stages: LogStage[];
  events: EventStreamMessage[];
};

type LogsTreeItem = LogsTreeStageItem | LogsTreeLogItem;

const createLogStage = (
  inactiveLabel: string,
  activeLabel: string,
  alternatePaths?: string[],
  collapseState?: TreeItemCollapsibleState,
  status: LogStageStatus = LogStageStatus.notStarted,
  stages: LogStage[] = [],
  events: EventStreamMessage[] = [],
): LogStage => {
  return {
    inactiveLabel,
    activeLabel,
    alternatePaths,
    collapseState,
    status,
    stages,
    events,
  };
};

const viewName = "posit.publisher.logs";
const visitCommand = viewName + ".visit";
const showContentRecordLogsCommand = "posit.publisher.logs.focus";

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
  private _onDidChangeTreeData: EventEmitter<LogsTreeItem | undefined> =
    new EventEmitter<LogsTreeItem | undefined>();

  /**
   * Creates an instance of LogsTreeDataProvider.
   * @constructor
   * @param {ExtensionContext} _context = The VSCode Extension's runtime context
   * @param {EventStream} _stream - The event stream to listen to.
   */
  constructor(
    private readonly _context: ExtensionContext,
    private readonly _stream: EventStream,
  ) {}

  private resetStages() {
    this.stages = new Map([
      [
        "publish/checkCapabilities",
        createLogStage("Check Capabilities", "Checking Capabilities"),
      ],
      [
        "publish/createBundle",
        createLogStage("Create Bundle", "Creating Bundle"),
      ],
      [
        "publish/uploadBundle",
        createLogStage("Upload Bundle", "Uploading Bundle"),
      ],
      [
        "publish/createContentRecord",
        createLogStage("Create ContentRecord", "Creating ContentRecord"),
      ],
      [
        "publish/deployBundle",
        createLogStage("Deploy Bundle", "Deploying Bundle"),
      ],
      [
        "publish/restoreEnv",
        createLogStage("Restore Environment", "Restoring Environment"),
      ],
      ["publish/runContent", createLogStage("Run Content", "Running Content")],
      [
        "publish/validateContentRecord",
        createLogStage("Validate ContentRecord", "Validating ContentRecord"),
      ],
    ]);

    this.publishingStage = createLogStage(
      "Publishing",
      "Published",
      undefined,
      TreeItemCollapsibleState.Expanded,
      LogStageStatus.notStarted,
      Array.from(this.stages.values()),
    );
  }

  private registerEvents() {
    // Reset events when a new publish starts
    this._stream.register("publish/start", (msg: EventStreamMessage) => {
      this.resetStages();
      this.publishingStage.inactiveLabel = `Publish to ${msg.data.server}`;
      this.publishingStage.activeLabel = `Publishing to ${msg.data.server}`;
      this.publishingStage.status = LogStageStatus.inProgress;
      this.refresh();
    });

    this._stream.register("publish/success", (msg: EventStreamMessage) => {
      this.publishingStage.status = LogStageStatus.completed;
      this.publishingStage.events.push(msg);

      this.stages.forEach((stage) => {
        if (stage.status === LogStageStatus.notStarted) {
          stage.status = LogStageStatus.skipped;
        }
      });

      this.refresh();
    });

    this._stream.register(
      "publish/failure",
      async (msg: EventStreamMessage) => {
        this.publishingStage.status = LogStageStatus.failed;
        this.publishingStage.events.push(msg);

        this.stages.forEach((stage) => {
          if (stage.status === LogStageStatus.notStarted) {
            stage.status = LogStageStatus.neverStarted;
          }
        });

        let showLogsOption = "Show Logs";
        const selection = await window.showErrorMessage(
          `ContentRecord failed: ${msg.data.message}`,
          showLogsOption,
        );
        if (selection === showLogsOption) {
          await commands.executeCommand(showContentRecordLogsCommand);
        }
        this.refresh();
      },
    );

    Array.from(this.stages.keys()).forEach((stageName) => {
      this._stream.register(`${stageName}/start`, (_: EventStreamMessage) => {
        const stage = this.stages.get(stageName);
        if (stage) {
          stage.status = LogStageStatus.inProgress;
        }
        this.refresh();
      });

      this._stream.register(`${stageName}/log`, (msg: EventStreamMessage) => {
        const stage = this.stages.get(stageName);
        if (stage && msg.data.level !== "DEBUG") {
          stage.events.push(msg);
        }
        this.refresh();
      });

      this._stream.register(`${stageName}/success`, (_: EventStreamMessage) => {
        const stage = this.stages.get(stageName);
        if (stage) {
          stage.status = LogStageStatus.completed;
        }
        this.refresh();
      });

      this._stream.register(
        `${stageName}/failure`,
        (msg: EventStreamMessage) => {
          const stage = this.stages.get(stageName);
          if (stage) {
            stage.status = LogStageStatus.failed;
            stage.events.push(msg);
          }
          this.refresh();
        },
      );
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
      result.push(...element.events.map((e) => new LogsTreeLogItem(e)));
      return result;
    }

    return [];
  }

  /**
   * Register the tree view in the extension this._context.
   * @param this._context The extension this._context.
   */
  public register() {
    // Initialize the stages map and the outer, publishing stage
    this.resetStages();

    // Register all of the events this view cares about
    this.registerEvents();

    // Create a tree view with the specified view name and options
    this._context.subscriptions.push(
      window.createTreeView(viewName, {
        treeDataProvider: this,
      }),
      commands.registerCommand(visitCommand, async (dashboardUrl: string) => {
        // This command is only attached to messages with a dashboardUrl field.
        const uri = Uri.parse(dashboardUrl, true);
        await env.openExternal(uri);
      }),
    );
  }
}

export class LogsTreeStageItem extends TreeItem {
  stages: LogStage[] = [];
  events: EventStreamMessage[] = [];
  stage: LogStage;

  constructor(stage: LogStage) {
    let collapsibleState = stage.collapseState;
    if (collapsibleState === undefined) {
      collapsibleState =
        stage.events.length || stage.stages.length
          ? TreeItemCollapsibleState.Collapsed
          : TreeItemCollapsibleState.None;
    }

    super(stage.inactiveLabel, collapsibleState);
    this.stage = stage;

    this.stages = stage.stages;
    this.events = stage.events;
    this.setLabelAndIcon(stage.status);
  }

  setLabelAndIcon(status: LogStageStatus) {
    switch (status) {
      case LogStageStatus.notStarted:
        this.label = this.stage.inactiveLabel;
        this.iconPath = new ThemeIcon("circle-large-outline");
        break;
      case LogStageStatus.neverStarted:
        this.label = this.stage.inactiveLabel;
        this.iconPath = new ThemeIcon("circle-slash");
        break;
      case LogStageStatus.skipped:
        this.label = `${this.stage.inactiveLabel} (skipped)`;
        this.iconPath = new ThemeIcon("check");
        break;
      case LogStageStatus.inProgress:
        this.label = this.stage.activeLabel;
        this.iconPath = new ThemeIcon("loading~spin");
        break;
      case LogStageStatus.completed:
        this.label = this.stage.inactiveLabel;
        this.iconPath = new ThemeIcon("check");
        break;
      case LogStageStatus.failed:
        this.label = this.stage.inactiveLabel;
        this.iconPath = new ThemeIcon("error");
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
    state: TreeItemCollapsibleState = TreeItemCollapsibleState.None,
  ) {
    super(displayEventStreamMessage(msg), state);
    this.tooltip = JSON.stringify(msg);

    if (msg.data.dashboardUrl !== undefined) {
      this.command = {
        title: "Visit",
        command: visitCommand,
        arguments: [msg.data.dashboardUrl],
      };
    }
  }
}
