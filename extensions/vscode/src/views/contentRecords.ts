// Copyright (C) 2024 by Posit Software, PBC.

import {
  Event,
  EventEmitter,
  ExtensionContext,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  Uri,
  WorkspaceFolder,
  commands,
  env,
  window,
  workspace,
} from "vscode";

import {
  AllContentRecordTypes,
  ContentRecord,
  ContentRecordError,
  PreContentRecord,
  isContentRecord,
  isPreContentRecord,
  isPreContentRecordWithConfig,
  useApi,
} from "src/api";

import { confirmForget } from "src/dialogs";
import { formatDateString } from "src/utils/date";
import { getSummaryStringFromError } from "src/utils/errors";
import { ensureSuffix } from "src/utils/files";
import { contentRecordNameValidator } from "src/utils/names";
import { WatcherManager } from "src/watchers";
import { Commands, Views } from "src/constants";

type ContentRecordsEventEmitter = EventEmitter<
  ContentRecordsTreeItem | undefined | void
>;
type ContentRecordsEvent = Event<ContentRecordsTreeItem | undefined | void>;

export class ContentRecordsTreeDataProvider
  implements TreeDataProvider<ContentRecordsTreeItem>
{
  private root: WorkspaceFolder | undefined;
  private _onDidChangeTreeData: ContentRecordsEventEmitter = new EventEmitter();
  readonly onDidChangeTreeData: ContentRecordsEvent =
    this._onDidChangeTreeData.event;

  constructor(private readonly _context: ExtensionContext) {
    const workspaceFolders = workspace.workspaceFolders;
    if (workspaceFolders !== undefined) {
      this.root = workspaceFolders[0];
    }
  }

  public refresh = () => {
    console.debug("refreshing deployment records");
    this._onDidChangeTreeData.fire();
  };

  getTreeItem(element: ContentRecordsTreeItem): TreeItem | Thenable<TreeItem> {
    return element;
  }

  async getChildren(
    element: ContentRecordsTreeItem | undefined,
  ): Promise<ContentRecordsTreeItem[]> {
    if (element) {
      // flat organization of contentRecords, so no children.
      return [];
    }
    const root = this.root;
    if (root === undefined) {
      // There can't be any contentRecords if we don't have a folder open.
      return [];
    }

    try {
      // API Returns:
      // 200 - success
      // 500 - internal server error
      const api = await useApi();
      const response = await api.contentRecords.getAll();
      const contentRecords = response.data;

      return contentRecords.map((contentRecord) => {
        const fileUri = Uri.file(contentRecord.deploymentPath);
        return new ContentRecordsTreeItem(contentRecord, fileUri);
      });
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "contentRecords::getChildren",
        error,
      );
      window.showInformationMessage(summary);
      return [];
    }
  }

  public register(watchers: WatcherManager) {
    const treeView = window.createTreeView(Views.ContentRecords, {
      treeDataProvider: this,
    });
    this._context.subscriptions.push(treeView);

    this._context.subscriptions.push(
      commands.registerCommand(Commands.ContentRecordsRefresh, this.refresh),
    );

    this._context.subscriptions.push(
      commands.registerCommand(
        Commands.ContentRecordForget,
        async (item: ContentRecordsTreeItem) => {
          const ok = await confirmForget(
            `Are you sure you want to forget this deployment '${item.contentRecord.deploymentName}' locally?`,
          );
          if (ok) {
            const api = await useApi();
            await api.contentRecords.delete(item.contentRecord.deploymentName);
          }
        },
      ),
    );

    this._context.subscriptions.push(
      commands.registerCommand(
        Commands.ContentRecordEdit,
        async (item: ContentRecordsTreeItem) => {
          await commands.executeCommand("vscode.open", item.fileUri);
        },
      ),
    );

    this._context.subscriptions.push(
      commands.registerCommand(
        Commands.ContentRecordVisit,
        async (item: ContentRecordsTreeItem) => {
          // This command is only registered for ContentRecords
          if (isContentRecord(item.contentRecord)) {
            const uri = Uri.parse(item.contentRecord.dashboardUrl, true);
            await env.openExternal(uri);
          }
        },
      ),
    );

    this._context.subscriptions.push(
      commands.registerCommand(
        Commands.ContentRecordRename,
        async (item: ContentRecordsTreeItem) => {
          let contentRecordNames: string[] = [];

          try {
            const api = await useApi();
            const response = await api.contentRecords.getAll();
            const contentRecordList = response.data;
            // Note.. we want all of the contentRecord filenames regardless if they are valid or not.
            contentRecordNames = contentRecordList.map(
              (contentRecord) => contentRecord.deploymentName,
            );
          } catch (error: unknown) {
            const summary = getSummaryStringFromError(
              "renameContentRecord, contentRecords.getAll",
              error,
            );
            window.showInformationMessage(
              `Unable to continue due to an error with the Deployment record. ${summary}`,
            );
            return;
          }

          const currentName = item.contentRecord.deploymentName;
          const newName = await window.showInputBox({
            prompt: "New Deployment name",
            value: currentName,
            validateInput: contentRecordNameValidator(
              contentRecordNames,
              currentName,
            ),
          });
          if (newName === undefined || newName === "") {
            // canceled
            return;
          }
          const oldUri = Uri.file(item.contentRecord.deploymentPath);
          const relativePath = "../" + ensureSuffix(".toml", newName);
          const newUri = Uri.joinPath(oldUri, relativePath);
          await workspace.fs.rename(oldUri, newUri, { overwrite: true });
        },
      ),
    );

    watchers.positDir?.onDidDelete(this.refresh, this);
    watchers.publishDir?.onDidDelete(this.refresh, this);
    watchers.contentRecordsDir?.onDidDelete(this.refresh, this);

    watchers.contentRecords?.onDidCreate(this.refresh, this);
    watchers.contentRecords?.onDidDelete(this.refresh, this);
    watchers.contentRecords?.onDidChange(this.refresh, this);
  }
}

export class ContentRecordsTreeItem extends TreeItem {
  constructor(
    public contentRecord: AllContentRecordTypes,
    public readonly fileUri: Uri,
  ) {
    super(contentRecord.deploymentName);

    if (isContentRecord(this.contentRecord)) {
      this.initializeContentRecord(this.contentRecord);
    } else if (
      isPreContentRecord(this.contentRecord) ||
      isPreContentRecordWithConfig(this.contentRecord)
    ) {
      this.initializePreContentRecord(this.contentRecord);
    } else {
      this.initializeContentRecordError(this.contentRecord);
    }
    this.command = {
      title: "Open",
      command: "vscode.open",
      arguments: [this.fileUri],
    };
  }

  private initializeContentRecord(contentRecord: ContentRecord) {
    this.contextValue =
      "posit.publisher.contentRecords.tree.item.contentRecord";
    if (!contentRecord.deploymentError) {
      this.tooltip =
        `ContentRecord file: ${contentRecord.deploymentPath}\n` +
        `\n` +
        `Last Deployed on ${formatDateString(contentRecord.deployedAt)}\n` +
        `Targeting ${contentRecord.serverType} at ${contentRecord.serverUrl}\n` +
        `GUID = ${contentRecord.id}`;
      this.iconPath = new ThemeIcon("cloud-upload");
    } else {
      this.tooltip =
        `Deployment record file: ${contentRecord.deploymentPath}\n` +
        `\n` +
        `Last Deployment Failed on ${formatDateString(contentRecord.deployedAt)}\n` +
        `Targeting ${contentRecord.serverType} at ${contentRecord.serverUrl}`;
      // contentRecord id may not yet be assigned...
      if (contentRecord.id) {
        this.tooltip += `\n` + `GUID = ${contentRecord.id}`;
      }
      this.tooltip +=
        "\n" + `\n` + `Error: ${contentRecord.deploymentError.msg}`;
      this.iconPath = new ThemeIcon("run-errors");
    }
  }

  private initializePreContentRecord(precontentRecord: PreContentRecord) {
    this.contextValue =
      "posit.publisher.contentRecords.tree.item.precontentRecord";
    this.tooltip =
      `Deployment Record file: ${precontentRecord.deploymentPath}\n` +
      `\n` +
      `Created on ${formatDateString(precontentRecord.createdAt)}\n` +
      `Targeting ${precontentRecord.serverType} at ${precontentRecord.serverUrl}\n` +
      `\n` +
      `Warning! Not yet deployed to the server`;
    this.iconPath = new ThemeIcon("ellipsis");
  }

  private initializeContentRecordError(deploymentError: ContentRecordError) {
    this.contextValue =
      "posit.publisher.contentRecords.tree.item.deploymentError";
    this.tooltip =
      `Deployment Record file: ${deploymentError.deploymentPath}\n` +
      `\n` +
      `ERROR! File is invalid\n` +
      `Code: ${deploymentError.error.code}\n` +
      `Msg: ${deploymentError.error.msg}\n` +
      `\n` +
      `Warning: This deployment record cannot be deployed\n` +
      `until the issue is resolved.`;

    this.iconPath = new ThemeIcon("warning");
  }
}
