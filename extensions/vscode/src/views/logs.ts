// Copyright (C) 2024 by Posit Software, PBC.

import {
  Disposable,
  Event,
  EventEmitter,
  ExtensionContext,
  ProviderResult,
  ThemeColor,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  TreeView,
  Uri,
  Webview,
  WebviewView,
  WebviewViewProvider,
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
  ProductType,
} from "src/api";
import { Commands, Views } from "src/constants";
import {
  ErrorMessageActionIds,
  findErrorMessageSplitOption,
} from "src/utils/errorEnhancer";
import { extensionSettings } from "src/extension";
import { showErrorMessageWithTroubleshoot } from "src/utils/window";
import { DeploymentFailureRenvHandler } from "src/views/deployHandlers";
import { getUri } from "src/utils/getUri";
import { getNonce } from "src/utils/getNonce";
import { formatTimestampString } from "src/utils/date";

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

const stages = new Map([
  [
    "publish/getRPackageDescriptions",
    createLogStage("Get Package Descriptions", "Getting Package Descriptions", [
      ProductType.CONNECT,
      ProductType.CONNECT_CLOUD,
    ]),
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
    createLogStage("Deploy Bundle", "Deploying Bundle", [ProductType.CONNECT]),
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

export class LogsViewProvider implements WebviewViewProvider, Disposable {
  private disposables: Disposable[] = [];
  private events: EventStreamMessage[] = [];
  private extensionUri: Uri;
  public static currentView: WebviewView | undefined = undefined;

  constructor(
    private readonly context: ExtensionContext,
    private readonly stream: EventStream,
  ) {
    this.extensionUri = this.context.extensionUri;
  }

  private static getLogsHTML(events: EventStreamMessage[]) {
    return events
      .map((e) => `${formatTimestampString(e.time)} ${e.data.message}`)
      .join("<br />")
      .trim();
  }

  public static refreshContent(events: EventStreamMessage[]) {
    if (LogsViewProvider.currentView) {
      LogsViewProvider.currentView.webview.postMessage({
        command: "refresh",
        data: LogsViewProvider.getLogsHTML(events),
      });
    }
  }

  public register() {
    this.stream.register("publish/start", (_: EventStreamMessage) => {
      // reset the events
      this.events = [];
      LogsViewProvider.refreshContent(this.events);
    });

    Array.from(stages.keys()).forEach((stageName) => {
      this.stream.register(`${stageName}/log`, (msg: EventStreamMessage) => {
        const stage = stages.get(stageName);
        if (stage && msg.data.level !== "DEBUG") {
          this.events.unshift(msg);
          LogsViewProvider.refreshContent(this.events);
        }
      });
    });

    this.context.subscriptions.push(
      window.registerWebviewViewProvider(Views.RawLogs, this, {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      }),
    );
  }

  public dispose() {
    Disposable.from(...this.disposables).dispose();
  }

  public resolveWebviewView(webviewView: WebviewView) {
    LogsViewProvider.currentView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        Uri.joinPath(
          this.extensionUri,
          "node_modules",
          "@vscode",
          "codicons",
          "dist",
        ),
      ],
    };

    webviewView.webview.html = this._getHtmlForWebview(
      webviewView.webview,
      this.extensionUri,
    );

    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case "copy":
          env.clipboard.writeText(
            String(message.text)
              .replaceAll("<br>", "\n")
              .replaceAll("<br/>", "\n")
              .replaceAll("<br />", "\n")
              .trim(),
          );
          window.showInformationMessage("Logs copied to clipboard!");
          return;
      }
    });
  }

  private _getHtmlForWebview(webview: Webview, extensionUri: Uri): string {
    // The codicon css (and related tff file) are needing to be loaded for icons
    const codiconsUri = getUri(webview, extensionUri, [
      "node_modules",
      "@vscode",
      "codicons",
      "dist",
      "codicon.css",
    ]);
    // Custom Posit Publisher font
    const positPublisherFontCssUri = getUri(webview, extensionUri, [
      "dist",
      "posit-publisher-icons.css",
    ]);

    const nonce = getNonce();

    return /*html*/ `
    <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link rel="stylesheet" type="text/css" href="${codiconsUri}">
          <link rel="stylesheet" type="text/css" href="${positPublisherFontCssUri}">
          <title>Raw Logs</title>
      </head>
      <body>
        <button
          id="copyButton"
          style="display:flex;align-items:center;border-radius:0.25rem;border:none;padding:0.25rem 0.5rem;cursor:pointer;"
        >
          <span class="codicon codicon-copy" style="margin-right:0.25rem;"></span>
          Copy Logs
        </button>
        <pre id="content">${LogsViewProvider.getLogsHTML(this.events)}</pre>
        <script nonce="${nonce}">
            const vscode = acquireVsCodeApi();
            window.addEventListener('message', event => {
              const message = event.data;
              if (message.command === 'refresh') {
                document.getElementById('content').innerHTML = message.data;
              }
            });
            document.getElementById('copyButton').addEventListener('click', () => {
              vscode.postMessage({
                command: 'copy',
                text: document.querySelector('#content').innerHTML
              });
            });
        </script>
      </body>
      </html>
    `;
  }
}

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
    this.stages = stages;

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

  private registerEvents() {
    // Reset events when a new publish starts
    this.stream.register("publish/start", (msg: EventStreamMessage) => {
      this.resetStages();
      this.stages.forEach((stage) => {
        if (!stage.productType.includes(msg.data.productType as ProductType)) {
          stage.status = LogStageStatus.notApplicable;
        }
      });
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

        if (
          stage.status === LogStageStatus.failed &&
          extensionSettings.autoOpenLogsOnFailure()
        ) {
          commands.executeCommand(Commands.Logs.TreeFocus);
          commands.executeCommand(Commands.Logs.WebviewFocus);
        }
      });

      const showLogsOption = "View Publishing Log";
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
        await commands.executeCommand(Commands.Logs.TreeFocus);
        await commands.executeCommand(Commands.Logs.WebviewFocus);
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
   * Returns either
   * the first LogsTreeStageItem with `LogStageStatus.failed` or
   * the last LogsTreeLogItem of that stage if the stage has events
   *
   * Returns `undefined` if no LogsTreeStageItems have `LogsStateStatus.failed`
   */
  private getTreeItemToReveal(): LogsTreeItem | undefined {
    const root = new LogsTreeStageItem(this.publishingStage);

    for (const stage of this.publishingStage.stages) {
      if (
        stage.status === LogStageStatus.failed ||
        stage.status === LogStageStatus.canceled
      ) {
        const stageItem = new LogsTreeStageItem(stage, root);

        if (stage.events.length) {
          const lastEventIndex = stage.events.length - 1;
          const lastEvent = stage.events[lastEventIndex];
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
   * Reveals the first failing LogsTreeStageItem in the tree view or the last
   * event of that stage if it has events.
   */
  public revealFailingState(treeView: TreeView<LogsTreeItem>): void {
    const revealItem = this.getTreeItemToReveal();

    if (revealItem) {
      treeView.reveal(revealItem, {
        select: true,
        focus: true,
      });
    }
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

    this.context.subscriptions.push(
      treeView,
      treeView.onDidChangeVisibility((e) => {
        if (e.visible) {
          this.revealFailingState(treeView);
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
    this.id = stage.inactiveLabel;
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
        break;
      case LogStageStatus.completed:
        this.label = this.stage.inactiveLabel;
        this.iconPath = new ThemeIcon(
          "check",
          new ThemeColor("testing.iconPassed"),
        );
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

    // Prefer logs urls when a validate deployment failure or publish failure
    const isFailureType =
      msg.type === "publish/validateDeployment/failure" ||
      msg.type === "publish/failure";

    const url = isFailureType
      ? msg.data.logsUrl || msg.data.dashboardUrl
      : msg.data.dashboardUrl;

    if (url) {
      this.command = {
        title: "View",
        command: Commands.Logs.Visit,
        arguments: [url],
      };
    }
  }
}
