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
import {
  isCodedEventErrorMessage,
  handleEventCodedError,
} from "src/eventErrors";

import {
  EventStreamMessage,
  isPublishFailure,
  isPublishSuccess,
  isPublishRestoreEnvStatus,
  restoreMsgToStatusSuffix,
} from "src/api";
import { Commands, Views } from "src/constants";
import {
  ErrorMessageActionIds,
  findErrorMessageSplitOption,
} from "src/utils/errorEnhancer";
import { showErrorMessageWithTroubleshoot } from "src/utils/window";
import { DeploymentFailureRenvHandler } from "src/views/deployHandlers";

enum LogStageStatus {
  notStarted,
  neverStarted,
  skipped,
  inProgress,
  completed,
  failed,
  canceled,
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

const RestoringEnvironmentLabel = "Restoring Environment";

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
  private treeDataChangeEventEmitter: EventEmitter<LogsTreeItem | undefined> =
    new EventEmitter<LogsTreeItem | undefined>();

  /**
   * Creates an instance of LogsTreeDataProvider.
   * @constructor
   * @param {ExtensionContext} context = The VSCode Extension's runtime context
   * @param {EventStream} stream - The event stream to listen to.
   */
  constructor(
    private readonly context: ExtensionContext,
    private readonly stream: EventStream,
  ) {}

  private resetStages() {
    this.stages = new Map([
      [
        "publish/getRPackageDescriptions",
        createLogStage(
          "Get Package Descriptions",
          "Getting Package Descriptions",
        ),
      ],
      // skipped
      [
        "publish/checkCapabilities",
        createLogStage("Check Capabilities", "Checking Capabilities"),
      ],
      [
        "publish/createBundle",
        createLogStage("Create Bundle", "Creating Bundle"),
      ],
      // new one
      [
        "publish/createRevision",
        createLogStage("Create Revision", "Creating Revision"),
      ],
      [
        "publish/uploadBundle",
        createLogStage("Upload Bundle", "Uploading Bundle"),
      ],
      // skipped
      [
        "publish/createDeployment",
        createLogStage(
          "Create Deployment Record",
          "Creating Deployment Record",
        ),
      ],
      // new one
      [
        "publish/publishRevision",
        createLogStage("Publish Revision", "Publishing Revision"),
      ],
      [
        "publish/deployBundle",
        createLogStage("Deploy Bundle", "Deploying Bundle"),
      ],
      // skipped
      [
        "publish/restoreEnv",
        createLogStage("Restore Environment", RestoringEnvironmentLabel),
      ],
      // skipped
      ["publish/runContent", createLogStage("Run Content", "Running Content")],
      // skipped
      [
        "publish/validateDeployment",
        createLogStage(
          "Validate Deployment Record",
          "Validating Deployment Record",
        ),
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
    this.stream.register("publish/start", (msg: EventStreamMessage) => {
      this.resetStages();
      this.publishingStage.inactiveLabel = `Publish "${msg.data.title}" to ${msg.data.server}`;
      this.publishingStage.activeLabel = `Publishing "${msg.data.title}" to ${msg.data.server}`;
      this.publishingStage.status = LogStageStatus.inProgress;
      this.refresh();
    });

    this.stream.register("publish/success", (msg: EventStreamMessage) => {
      this.publishingStage.status = LogStageStatus.completed;
      this.publishingStage.events.push(msg);

      this.stages.forEach((stage) => {
        if (stage.status === LogStageStatus.notStarted) {
          stage.status = LogStageStatus.skipped;
        }
      });

      this.refresh();
    });

    this.stream.register("publish/failure", async (msg: EventStreamMessage) => {
      const deploymentFailureRenvHandler = new DeploymentFailureRenvHandler();
      if (deploymentFailureRenvHandler.shouldHandleEventMsg(msg)) {
        return deploymentFailureRenvHandler.handle(msg).then(this.refresh);
      }

      const failedOrCanceledStatus = msg.data.canceled
        ? LogStageStatus.canceled
        : LogStageStatus.failed;
      this.publishingStage.status = failedOrCanceledStatus;
      this.publishingStage.events.push(msg);

      this.stages.forEach((stage) => {
        if (stage.status === LogStageStatus.notStarted) {
          stage.status = LogStageStatus.neverStarted;
        } else if (stage.status === LogStageStatus.inProgress) {
          stage.status = failedOrCanceledStatus;
        }
      });

      const showLogsOption = "View Log";
      const options = [showLogsOption];
      const enhancedError = findErrorMessageSplitOption(msg.data.message);
      if (enhancedError && enhancedError.buttonStr) {
        options.push(enhancedError.buttonStr);
      }
      let errorMessage = "";
      if (isCodedEventErrorMessage(msg)) {
        errorMessage = handleEventCodedError(msg);
      } else {
        errorMessage =
          msg.data.canceled === "true"
            ? msg.data.message
            : `Deployment failed: ${msg.data.message}`;
      }
      let selection: string | undefined;
      if (msg.data.canceled === "true") {
        selection = await window.showInformationMessage(
          errorMessage,
          ...options,
        );
      } else {
        selection = await showErrorMessageWithTroubleshoot(
          errorMessage,
          ...options,
        );
      }
      if (selection === showLogsOption) {
        await commands.executeCommand(Commands.Logs.Focus);
      } else if (selection === enhancedError?.buttonStr) {
        if (
          enhancedError?.actionId === ErrorMessageActionIds.EditConfiguration
        ) {
          await commands.executeCommand(
            Commands.HomeView.EditCurrentConfiguration,
          );
        }
      }
      this.refresh();
    });

    Array.from(this.stages.keys()).forEach((stageName) => {
      this.stream.register(
        `${stageName}/start`,
        (/* _: EventStreamMessage */) => {
          const stage = this.stages.get(stageName);
          if (stage) {
            stage.status = LogStageStatus.inProgress;
          }
          this.refresh();
        },
      );

      this.stream.register(`${stageName}/log`, (msg: EventStreamMessage) => {
        const stage = this.stages.get(stageName);
        if (stage && msg.data.level !== "DEBUG") {
          stage.events.push(msg);
        }
        this.refresh();
      });

      this.stream.register(
        `${stageName}/success`,
        (/* _: EventStreamMessage */) => {
          const stage = this.stages.get(stageName);
          if (stage) {
            stage.status = LogStageStatus.completed;
          }
          this.refresh();
        },
      );

      this.stream.register(
        `${stageName}/failure`,
        (msg: EventStreamMessage) => {
          const stage = this.stages.get(stageName);
          if (stage) {
            if (msg.data.canceled === "true") {
              stage.status = LogStageStatus.canceled;
            } else {
              stage.status = LogStageStatus.failed;
            }
            stage.events.push(msg);
          }
          this.refresh();
        },
      );

      // Register for some specific events we need to handle differently
      this.stream.register(
        "publish/restoreEnv/status",
        (msg: EventStreamMessage) => {
          const stage = this.stages.get("publish/restoreEnv");
          if (stage && isPublishRestoreEnvStatus(msg)) {
            stage.activeLabel = `${RestoringEnvironmentLabel} - ${restoreMsgToStatusSuffix(msg)}`;
          }
        },
      );
    });
  }

  /**
   * Get the event emitter for tree data changes.
   */
  get onDidChangeTreeData(): Event<LogsTreeItem | undefined> {
    return this.treeDataChangeEventEmitter.event;
  }

  /**
   * Refresh the tree view by firing the onDidChangeTreeData event.
   */
  public refresh(): void {
    this.treeDataChangeEventEmitter.fire(undefined);
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
   * @param The parent element.
   * @returns The child elements of the parent element.
   */
  getChildren(element?: LogsTreeItem): ProviderResult<Array<LogsTreeItem>> {
    if (element === undefined) {
      return [new LogsTreeStageItem(this.publishingStage)];
    }

    // Map the events array to LogsTreeItem instances and return them as children
    if (element instanceof LogsTreeStageItem) {
      const result = [];
      let count = 0;
      element.stages.forEach((stage: LogStage) => {
        result.push(new LogsTreeStageItem(stage));
      });
      result.push(
        ...element.events.map(
          (e) =>
            new LogsTreeLogItem(
              e,
              TreeItemCollapsibleState.None,
              `${element.id}/${count++}`,
            ),
        ),
      );
      return result;
    }

    return [];
  }

  /**
   * Register the tree view in the extension this.context.
   * @param this.context The extension this.context.
   */
  public register() {
    // Initialize the stages map and the outer, publishing stage
    this.resetStages();

    // Register all of the events this view cares about
    this.registerEvents();

    // Create a tree view with the specified view name and options
    this.context.subscriptions.push(
      window.createTreeView(Views.Logs, {
        treeDataProvider: this,
      }),
      commands.registerCommand(
        Commands.Logs.Visit,
        async (dashboardUrl: string) => {
          // This command is only attached to messages with a dashboardUrl field.
          const uri = Uri.parse(dashboardUrl, true);
          await env.openExternal(uri);
        },
      ),
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
    this.id = stage.inactiveLabel;
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
        this.collapsibleState = TreeItemCollapsibleState.Expanded;
        break;
      case LogStageStatus.canceled:
        this.label = this.stage.inactiveLabel;
        this.iconPath = new ThemeIcon("circle-slash");
        this.collapsibleState = TreeItemCollapsibleState.Expanded;
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
    id: string,
  ) {
    if (msg.data.message) {
      msg.data.message = msg.data.message.replaceAll("\n", " ");
    }
    super(displayEventStreamMessage(msg), state);
    this.id = id;
    this.tooltip = JSON.stringify(msg);
    if (!isPublishSuccess(msg) && !isPublishFailure(msg)) {
      this.iconPath = new ThemeIcon("debug-stackframe-dot");
    }

    if (msg.data.dashboardUrl !== undefined) {
      this.command = {
        title: "View",
        command: Commands.Logs.Visit,
        arguments: [msg.data.dashboardUrl],
      };
    }
  }
}
