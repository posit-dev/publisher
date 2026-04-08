// Copyright (C) 2024 by Posit Software, PBC.

import {
  Event,
  EventEmitter,
  ExtensionContext,
  ProviderResult,
  Range,
  ThemeColor,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  TreeView,
  Uri,
  WebviewView,
  commands,
  env,
  window,
  workspace,
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
  ProductType,
} from "src/api";
import {
  ConnectAPI,
  ContentID,
  type JobLogEntry,
} from "@posit-dev/connect-api";
import { Commands, Views } from "src/constants";
import {
  ErrorMessageActionIds,
  findErrorMessageSplitOption,
} from "src/utils/errorEnhancer";
import { extensionSettings } from "src/extension";
import { showErrorMessageWithTroubleshoot } from "src/utils/window";
import { DeploymentFailureRenvHandler } from "src/views/deployHandlers";
import { stripMilliseconds } from "src/utils/date";

enum LogStageStatus {
  notStarted,
  neverStarted,
  skipped,
  inProgress,
  completed,
  failed,
  canceled,
  notApplicable,
}

type LogStage = {
  inactiveLabel: string;
  activeLabel: string;
  alternatePaths?: string[];
  collapseState?: TreeItemCollapsibleState;
  status: LogStageStatus;
  stages: LogStage[];
  events: EventStreamMessage[];
  productType: ProductType[];
};

type LogsTreeItem = LogsTreeStageItem | LogsTreeLogItem;

const createLogStage = (
  inactiveLabel: string,
  activeLabel: string,
  productType: ProductType[] = [],
  alternatePaths?: string[],
  collapseState?: TreeItemCollapsibleState,
  status: LogStageStatus = LogStageStatus.notStarted,
  stages: LogStage[] = [],
  events: EventStreamMessage[] = [],
): LogStage => {
  return {
    inactiveLabel,
    activeLabel,
    productType,
    alternatePaths,
    collapseState,
    status,
    stages,
    events,
  };
};

const RestoringEnvironmentLabel = "Restoring Environment";

// Factory function to create fresh stage objects on each call.
// This prevents event accumulation across deployments.
const createStagesMap = (): Map<string, LogStage> =>
  new Map([
    [
      "publish/getRPackageDescriptions",
      createLogStage(
        "Get Package Descriptions",
        "Getting Package Descriptions",
        [ProductType.CONNECT, ProductType.CONNECT_CLOUD],
      ),
    ],
    [
      "publish/checkCapabilities",
      createLogStage("Check Capabilities", "Checking Capabilities", [
        ProductType.CONNECT,
      ]),
    ],
    [
      "publish/createBundle",
      createLogStage("Create Bundle", "Creating Bundle", [
        ProductType.CONNECT,
        ProductType.CONNECT_CLOUD,
      ]),
    ],
    [
      "publish/updateContent",
      createLogStage("Update Content", "Updating Content", [
        ProductType.CONNECT_CLOUD,
      ]),
    ],
    [
      "publish/uploadBundle",
      createLogStage("Upload Bundle", "Uploading Bundle", [
        ProductType.CONNECT,
        ProductType.CONNECT_CLOUD,
      ]),
    ],
    [
      "publish/createDeployment",
      createLogStage("Create Deployment Record", "Creating Deployment Record", [
        ProductType.CONNECT,
      ]),
    ],
    [
      "publish/deployContent",
      createLogStage("Deploy Content", "Deploying Content", [
        ProductType.CONNECT_CLOUD,
      ]),
    ],
    [
      "publish/deployBundle",
      createLogStage("Deploy Bundle", "Deploying Bundle", [
        ProductType.CONNECT,
      ]),
    ],
    [
      "publish/restoreEnv",
      createLogStage("Restore Environment", RestoringEnvironmentLabel, [
        ProductType.CONNECT,
      ]),
    ],
    [
      "publish/runContent",
      createLogStage("Run Content", "Running Content", [ProductType.CONNECT]),
    ],
    [
      "publish/validateDeployment",
      createLogStage(
        "Validate Deployment Record",
        "Validating Deployment Record",
        [ProductType.CONNECT],
      ),
    ],
  ]);

class EventStreamRepository {
  private events: EventStreamMessage[];
  private streaming: boolean;

  constructor() {
    this.events = [];
    this.streaming = false;
  }

  reset() {
    this.events = [];
  }

  parseEvent(ev: EventStreamMessage) {
    return `${stripMilliseconds(ev.time)} ${ev.data.message}`;
  }

  logsText() {
    return this.events.map(this.parseEvent).join("\n").trim();
  }

  count() {
    return this.events.length;
  }

  push(ev: EventStreamMessage) {
    this.events.push(ev);
  }

  streamInProgress(flag?: boolean): boolean {
    if (flag !== undefined) {
      this.streaming = flag;
    }
    return this.streaming;
  }

  async openDocumentLog() {
    let evCountTracker = this.count();
    const content = this.logsText();
    const document = await workspace.openTextDocument({ content });
    const editor = await window.showTextDocument(document);

    // Stream will proceed until incoming events stop or events to print out are still pending
    while (this.streamInProgress() || this.count() > evCountTracker) {
      const ev = this.events[evCountTracker];
      if (!ev) {
        // Wait a bit if we are at the tip of the stream
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }
      const lastLine = document.lineAt(document.lineCount - 1);
      const range = new Range(lastLine.range.end, lastLine.range.end);
      const parsedEv = this.parseEvent(ev);
      await editor.edit((editBuilder) => {
        editBuilder.insert(range.end, `\n${parsedEv}`);
        editor.revealRange(range);
      });
      evCountTracker++;
    }
  }
}

export class LogsViewProvider {
  private static eventsRepository: EventStreamRepository =
    new EventStreamRepository();
  public static currentView: WebviewView | undefined = undefined;

  constructor(private readonly stream: EventStream) {}

  public static getLogsText() {
    return LogsViewProvider.eventsRepository.logsText();
  }

  public register() {
    this.stream.register("publish/start", (_: EventStreamMessage) => {
      // reset the events
      LogsViewProvider.eventsRepository.reset();
      LogsViewProvider.eventsRepository.streamInProgress(true);
    });

    // Get stage names from a fresh stages map for event registration
    const stagesMap = createStagesMap();
    Array.from(stagesMap.keys()).forEach((stageName) => {
      this.stream.register(`${stageName}/log`, (msg: EventStreamMessage) => {
        const stage = stagesMap.get(stageName);
        if (stage && msg.data.level !== "DEBUG") {
          LogsViewProvider.eventsRepository.push(msg);
        }
      });
    });

    this.stream.register("publish/success", (_: EventStreamMessage) => {
      LogsViewProvider.eventsRepository.streamInProgress(false);
    });

    this.stream.register("publish/failure", (_: EventStreamMessage) => {
      LogsViewProvider.eventsRepository.streamInProgress(false);
    });
  }

  public static openRawLogFileView() {
    return LogsViewProvider.eventsRepository.openDocumentLog();
  }

  public static copyLogs() {
    env.clipboard.writeText(LogsViewProvider.getLogsText());
    window.showInformationMessage("Logs copied to clipboard!");
  }
}

export type CredentialResolver = (
  serverUrl: string,
) => { url: string; apiKey: string } | undefined;

/**
 * Tree data provider for the Logs view.
 */
export class LogsTreeDataProvider implements TreeDataProvider<LogsTreeItem> {
  private stages!: Map<string, LogStage>;
  private publishingStage!: LogStage;
  private treeView?: TreeView<LogsTreeItem>;

  // Tracked per-deployment so we can fetch job logs on validation failure
  private trackedContentId: string | undefined;
  private trackedServerUrl: string | undefined;

  /**
   * Reveal helper that checks visibility immediately before calling reveal.
   * This prevents race conditions where the view is closed between the start
   * of a reveal method and the actual reveal() call.
   */
  private safeReveal(
    ...args: Parameters<TreeView<LogsTreeItem>["reveal"]>
  ): void {
    if (!this.treeView?.visible) {
      return;
    }
    this.treeView.reveal(...args);
  }

  /**
   * Event emitter for when the tree data of the Logs view changes.
   * @private
   */
  private treeDataChangeEventEmitter: EventEmitter<LogsTreeItem | undefined> =
    new EventEmitter<LogsTreeItem | undefined>();

  /**
   * Creates an instance of LogsTreeDataProvider.
   * @constructor
   * @param {ExtensionContext} context - The VSCode Extension's runtime context
   * @param {EventStream} stream - The event stream to listen to.
   * @param {CredentialResolver} credentialResolver - Resolves server URL to credentials for Connect API calls.
   */
  constructor(
    private readonly context: ExtensionContext,
    private readonly stream: EventStream,
    private readonly credentialResolver?: CredentialResolver,
  ) {}

  private resetStages() {
    this.stages = createStagesMap();
    this.trackedContentId = undefined;
    this.trackedServerUrl = undefined;

    this.publishingStage = createLogStage(
      "Publishing",
      "Published",
      [ProductType.CONNECT, ProductType.CONNECT_CLOUD],
      undefined,
      TreeItemCollapsibleState.Expanded,
      LogStageStatus.notStarted,
      Array.from(this.stages.values()),
    );
  }

  /**
   * Fetches the latest failed job's error log from Connect and appends
   * the tail lines as synthetic log events under the given stage.
   */
  private async fetchJobErrorLog(stage: LogStage): Promise<void> {
    if (!this.trackedContentId || !this.trackedServerUrl) {
      return;
    }
    if (!this.credentialResolver) {
      return;
    }

    const credential = this.credentialResolver(this.trackedServerUrl);
    if (!credential) {
      return;
    }

    try {
      const connectApi = new ConnectAPI({
        url: credential.url,
        apiKey: credential.apiKey,
        rejectUnauthorized: extensionSettings.verifyCertificates(),
      });
      const contentId = ContentID(this.trackedContentId);
      const { data: jobs } = await connectApi.getJobs(contentId);

      // Find the most recent failed job (status != 0, latest by start_time)
      const failedJobs = jobs
        .filter((j) => j.status !== 0)
        .sort(
          (a, b) =>
            new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
        );
      const latestFailedJob = failedJobs[0];
      if (!latestFailedJob) {
        return;
      }

      const { data: logEntries } = await connectApi.getJobLog(
        contentId,
        latestFailedJob.key,
      );

      if (logEntries.length === 0) {
        return;
      }

      // Store full log for "open full log" action
      this.lastJobLogEntries = logEntries;

      // Append tail lines as synthetic events under the stage
      const tailCount = 10;
      const tail = logEntries.slice(-tailCount);
      if (logEntries.length > tailCount) {
        stage.events.push(
          this.syntheticLogEvent(
            `--- Showing last ${tailCount} of ${logEntries.length} job log lines (click to view full log) ---`,
            true,
          ),
        );
      }
      for (const entry of tail) {
        stage.events.push(this.syntheticLogEvent(entry.data));
      }

      this.refresh();
      this.revealLatestLog("publish/validateDeployment");
    } catch (error) {
      console.error("Failed to fetch job error log:", error);
    }
  }

  private lastJobLogEntries: JobLogEntry[] = [];

  private syntheticLogEvent(
    message: string,
    jobLogAction = false,
  ): EventStreamMessage {
    return {
      type: "publish/validateDeployment/log",
      time: new Date().toISOString(),
      data: {
        message,
        level: "ERROR",
        ...(jobLogAction ? { jobLogAction: "true" } : {}),
      },
    };
  }

  public static async openJobErrorLog(
    logEntries: JobLogEntry[],
  ): Promise<void> {
    const content = logEntries.map((e) => `[${e.source}] ${e.data}`).join("\n");
    const document = await workspace.openTextDocument({ content });
    await window.showTextDocument(document);
  }

  private registerEvents() {
    // Reset events when a new publish starts
    this.stream.register("publish/start", (msg: EventStreamMessage) => {
      try {
        this.resetStages();
        this.stages.forEach((stage) => {
          if (
            !stage.productType.includes(msg.data.productType as ProductType)
          ) {
            stage.status = LogStageStatus.notApplicable;
          }
        });
        this.trackedServerUrl = msg.data.server;
        this.publishingStage.inactiveLabel = `Publish "${msg.data.title}" to ${msg.data.server}`;
        this.publishingStage.activeLabel = `Publishing "${msg.data.title}" to ${msg.data.server}`;
        this.publishingStage.status = LogStageStatus.inProgress;
        this.refresh();
        this.openLogsView();
      } catch (error) {
        console.error(
          "LogsTreeDataProvider publish/start handler error:",
          error,
        );
      }
    });

    this.stream.register("publish/success", (msg: EventStreamMessage) => {
      try {
        this.publishingStage.status = LogStageStatus.completed;
        this.publishingStage.events.push(msg);

        this.stages.forEach((stage) => {
          if (stage.status === LogStageStatus.notStarted) {
            stage.status = LogStageStatus.skipped;
          }
        });

        this.refresh();
      } catch (error) {
        console.error(
          "LogsTreeDataProvider publish/success handler error:",
          error,
        );
      }
    });

    this.stream.register("publish/failure", async (msg: EventStreamMessage) => {
      try {
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

          if (
            stage.status === LogStageStatus.failed &&
            extensionSettings.autoOpenLogsOnFailure()
          ) {
            commands.executeCommand(Commands.Logs.Focus);
          }
        });

        // Refresh immediately so the tree shows failure state before
        // the error notification dialog blocks on user interaction.
        this.refresh();

        const showLogsOption = "View Publishing Log";
        const options = [showLogsOption];
        const messageText = msg.data.message ?? "";
        const enhancedError = findErrorMessageSplitOption(messageText);
        if (enhancedError && enhancedError.buttonStr) {
          options.push(enhancedError.buttonStr);
        }
        let errorMessage = "";
        if (isCodedEventErrorMessage(msg)) {
          errorMessage = handleEventCodedError(msg);
        } else {
          errorMessage =
            msg.data.canceled === "true"
              ? messageText
              : `Deployment failed: ${messageText}`;
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
      } catch (error) {
        console.error(
          "LogsTreeDataProvider publish/failure handler error:",
          error,
        );
      }
    });

    // Track contentId from deployment creation events
    this.stream.register(
      "publish/createNewDeployment/success",
      (msg: EventStreamMessage) => {
        if (msg.data.contentId) {
          this.trackedContentId = msg.data.contentId;
        }
      },
    );
    this.stream.register(
      "publish/createDeployment/start",
      (msg: EventStreamMessage) => {
        if (msg.data.contentId) {
          this.trackedContentId = msg.data.contentId;
        }
      },
    );

    Array.from(this.stages.keys()).forEach((stageName) => {
      this.stream.register(
        `${stageName}/start`,
        (/* _: EventStreamMessage */) => {
          const stage = this.stages.get(stageName);
          if (stage) {
            stage.status = LogStageStatus.inProgress;
          }
          this.refresh();
          this.expandStage(stageName);
        },
      );

      this.stream.register(`${stageName}/log`, (msg: EventStreamMessage) => {
        const stage = this.stages.get(stageName);
        if (stage && msg.data.level !== "DEBUG") {
          stage.events.push(msg);
        }
        this.refresh();
        this.revealLatestLog(stageName);
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
        async (msg: EventStreamMessage) => {
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
          this.revealFailure();

          // Fetch job error log when content validation fails
          if (stageName === "publish/validateDeployment" && stage) {
            await this.fetchJobErrorLog(stage);
          }
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
    const root = new LogsTreeStageItem(this.publishingStage);
    if (element === undefined) {
      return [root];
    }

    // Map the events array to LogsTreeItem instances and return them as children
    if (element instanceof LogsTreeStageItem) {
      const result = [];
      let count = 0;
      element.stages.forEach((stage: LogStage) => {
        if (stage.status !== LogStageStatus.notApplicable) {
          result.push(new LogsTreeStageItem(stage, root));
        }
      });
      result.push(
        ...element.events.map(
          (e) =>
            new LogsTreeLogItem(
              { msg: e, id: `${element.id}/${count++}`, parent: element },
              TreeItemCollapsibleState.None,
            ),
        ),
      );
      return result;
    }

    return [];
  }

  getParent(element: LogsTreeItem): ProviderResult<LogsTreeItem> {
    return element.parent;
  }

  /**
   * Returns the failure log item (last event) from the first failed or canceled stage.
   * If the failed stage has no events, returns the stage item itself.
   * Returns `undefined` if no stages have failed or been canceled.
   */
  private getFailureItem(): LogsTreeItem | undefined {
    const root = new LogsTreeStageItem(this.publishingStage);

    for (const stage of this.publishingStage.stages) {
      if (
        stage.status === LogStageStatus.failed ||
        stage.status === LogStageStatus.canceled
      ) {
        const stageItem = new LogsTreeStageItem(stage, root);

        const lastEventIndex = stage.events.length - 1;
        const lastEvent = stage.events[lastEventIndex];

        if (stage.events.length && lastEvent) {
          return new LogsTreeLogItem(
            {
              msg: lastEvent,
              id: `${stageItem.id}/${lastEventIndex}`,
              parent: stageItem,
            },
            TreeItemCollapsibleState.None,
          );
        }

        return stageItem;
      }
    }

    return undefined;
  }

  /**
   * Reveals the failure log item from the first failed or canceled stage.
   * Only reveals if the tree view is visible.
   */
  private revealFailure(): void {
    if (!this.treeView?.visible) {
      return;
    }

    const revealItem = this.getFailureItem();

    if (revealItem) {
      this.safeReveal(revealItem, {
        select: true,
        focus: true,
      });
    }
  }

  /**
   * Expands a stage in the tree view by name.
   * Used to auto-expand stages when they start running.
   * Only expands if the tree view is visible to avoid reopening
   * the logs view if the user closed it during deployment.
   */
  private expandStage(stageName: string): void {
    if (!this.treeView?.visible) {
      return;
    }

    const stage = this.stages.get(stageName);
    if (!stage) return;

    const root = new LogsTreeStageItem(this.publishingStage);
    const stageItem = new LogsTreeStageItem(stage, root);

    this.safeReveal(stageItem, { expand: true });
  }

  /**
   * Opens the logs view and reveals the root publishing stage.
   * Called when a deployment starts to show the logs view.
   */
  private openLogsView(): void {
    if (!this.treeView) {
      return;
    }

    const root = new LogsTreeStageItem(this.publishingStage);
    this.treeView.reveal(root, { expand: true });
  }

  /**
   * Reveals the latest log item in a stage to auto-scroll to the bottom.
   * Only reveals if the tree view is currently visible.
   */
  private revealLatestLog(stageName: string): void {
    if (!this.treeView?.visible) {
      return;
    }

    const stage = this.stages.get(stageName);
    if (!stage || stage.events.length === 0) return;

    const root = new LogsTreeStageItem(this.publishingStage);
    const stageItem = new LogsTreeStageItem(stage, root);

    const lastEventIndex = stage.events.length - 1;
    const lastEvent = stage.events[lastEventIndex];
    if (!lastEvent) return;

    const logItem = new LogsTreeLogItem(
      {
        msg: lastEvent,
        id: `${stageItem.id}/${lastEventIndex}`,
        parent: stageItem,
      },
      TreeItemCollapsibleState.None,
    );

    this.safeReveal(logItem);
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
    const treeView = window.createTreeView(Views.Logs, {
      treeDataProvider: this,
    });
    this.treeView = treeView;

    this.context.subscriptions.push(
      treeView,
      treeView.onDidChangeVisibility((e) => {
        if (e.visible) {
          this.revealFailure();
        }
      }),
      commands.registerCommand(
        Commands.Logs.Visit,
        async (dashboardUrl: string) => {
          // This command is only attached to messages with a dashboardUrl field.
          const uri = Uri.parse(dashboardUrl, true);
          await env.openExternal(uri);
        },
      ),
      commands.registerCommand(Commands.Logs.ViewJobLog, async () => {
        if (this.lastJobLogEntries.length > 0) {
          await LogsTreeDataProvider.openJobErrorLog(this.lastJobLogEntries);
        }
      }),
    );
  }
}

export class LogsTreeStageItem extends TreeItem {
  stages: LogStage[] = [];
  events: EventStreamMessage[] = [];
  stage: LogStage;
  parent?: LogsTreeStageItem;

  constructor(stage: LogStage, parent?: LogsTreeStageItem) {
    let collapsibleState = stage.collapseState;
    if (collapsibleState === undefined) {
      collapsibleState =
        stage.events.length || stage.stages.length
          ? TreeItemCollapsibleState.Collapsed
          : TreeItemCollapsibleState.None;
    }

    super(stage.inactiveLabel, collapsibleState);
    // Include status in ID for completed leaf stages so VSCode treats them as new
    // items and respects the collapsibleState (Collapsed) we set. Without this,
    // VSCode preserves the expanded state from when the stage was in progress.
    // Exclude parent stages (like the root "Publishing" stage) which have child stages.
    const isLeafStage = stage.stages.length === 0;
    this.id =
      isLeafStage && stage.status === LogStageStatus.completed
        ? `${stage.inactiveLabel}-completed`
        : stage.inactiveLabel;
    this.stage = stage;
    this.parent = parent;

    this.stages = stage.stages;
    this.events = stage.events;
    this.setLabelAndIcon(stage.status);
  }

  setLabelAndIcon(status: LogStageStatus) {
    switch (status) {
      case LogStageStatus.notStarted:
        this.label = this.stage.inactiveLabel;
        this.iconPath = new ThemeIcon(
          "circle-large-outline",
          new ThemeColor("testing.iconQueued"),
        );
        break;
      case LogStageStatus.neverStarted:
        this.label = this.stage.inactiveLabel;
        this.iconPath = new ThemeIcon(
          "circle-slash",
          new ThemeColor("testing.iconSkipped"),
        );
        break;
      case LogStageStatus.skipped:
        this.label = `${this.stage.inactiveLabel} (skipped)`;
        this.iconPath = new ThemeIcon(
          "check",
          new ThemeColor("testing.iconSkipped"),
        );
        break;
      case LogStageStatus.inProgress:
        this.label = this.stage.activeLabel;
        this.iconPath = new ThemeIcon("loading~spin");
        this.collapsibleState = TreeItemCollapsibleState.Expanded;
        break;
      case LogStageStatus.completed:
        this.label = this.stage.inactiveLabel;
        this.iconPath = new ThemeIcon(
          "check",
          new ThemeColor("testing.iconPassed"),
        );
        this.collapsibleState = TreeItemCollapsibleState.Collapsed;
        break;
      case LogStageStatus.failed:
        this.label = this.stage.inactiveLabel;
        this.iconPath = new ThemeIcon(
          "error",
          new ThemeColor("testing.iconErrored"),
        );
        this.collapsibleState = TreeItemCollapsibleState.Expanded;
        break;
      case LogStageStatus.canceled:
        this.label = this.stage.inactiveLabel;
        this.iconPath = new ThemeIcon(
          "circle-slash",
          new ThemeColor("testing.iconSkipped"),
        );
        this.collapsibleState = TreeItemCollapsibleState.Expanded;
        break;
      case LogStageStatus.notApplicable:
        this.label = `${this.stage.inactiveLabel} (not applicable)`;
        this.iconPath = new ThemeIcon(
          "circle-slash",
          new ThemeColor("testing.iconSkipped"),
        );
        break;
    }
  }
}

/**
 * Represents a tree item for displaying logs in the tree view.
 */
export class LogsTreeLogItem extends TreeItem {
  parent: LogsTreeStageItem;

  constructor(
    {
      msg,
      id,
      parent,
    }: { msg: EventStreamMessage; id: string; parent: LogsTreeStageItem },
    state: TreeItemCollapsibleState = TreeItemCollapsibleState.None,
  ) {
    if (msg.data.message) {
      msg.data.message = msg.data.message.replaceAll("\n", " ");
    }
    super(displayEventStreamMessage(msg), state);
    this.id = id;
    this.tooltip = JSON.stringify(msg);
    this.parent = parent;
    if (!isPublishSuccess(msg) && !isPublishFailure(msg)) {
      this.iconPath = new ThemeIcon("debug-stackframe-dot");
    }

    // Allow synthetic job log header lines to open the full log
    if (msg.data.jobLogAction) {
      this.command = {
        title: "View Full Job Log",
        command: Commands.Logs.ViewJobLog,
      };
    }

    // Prefer logs urls when a validate deployment failure or publish failure
    const isFailureType =
      msg.type === "publish/validateDeployment/failure" ||
      msg.type === "publish/failure";

    const url = isFailureType
      ? msg.data.logsUrl || msg.data.dashboardUrl
      : msg.data.dashboardUrl;

    if (!msg.data.jobLogAction && url) {
      this.command = {
        title: "View",
        command: Commands.Logs.Visit,
        arguments: [url],
      };
    }
  }
}
