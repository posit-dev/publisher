import {
  Disposable,
  RelativePattern,
  WorkspaceFolder,
  FileSystemWatcher,
  workspace,
} from "vscode";

import {
  PUBLISH_DEPLOYMENTS_FOLDER,
  POSIT_FOLDER,
  PUBLISH_FOLDER,
  CONFIGURATIONS_PATTERN,
  DEPLOYMENTS_PATTERN,
} from "src/constants";

/**
 * Manages all the file system watchers for the extension.
 *
 * The directory watchers only watch for onDidDelete events.
 */
export class WatcherManager implements Disposable {
  positDir: FileSystemWatcher | undefined;
  publishDir: FileSystemWatcher | undefined;
  configurations: FileSystemWatcher | undefined;
  deploymentsDir: FileSystemWatcher | undefined;
  deployments: FileSystemWatcher | undefined;
  allFiles: FileSystemWatcher | undefined;

  constructor(root?: WorkspaceFolder) {
    if (root === undefined) {
      return;
    }

    this.positDir = workspace.createFileSystemWatcher(
      new RelativePattern(root, POSIT_FOLDER),
      true,
      true,
      false,
    );

    this.publishDir = workspace.createFileSystemWatcher(
      new RelativePattern(root, PUBLISH_FOLDER),
      true,
      true,
      false,
    );

    this.configurations = workspace.createFileSystemWatcher(
      new RelativePattern(root, CONFIGURATIONS_PATTERN),
    );

    this.deploymentsDir = workspace.createFileSystemWatcher(
      new RelativePattern(root, PUBLISH_DEPLOYMENTS_FOLDER),
      true,
      true,
      false,
    );

    this.deployments = workspace.createFileSystemWatcher(
      new RelativePattern(root, DEPLOYMENTS_PATTERN),
    );

    this.allFiles = workspace.createFileSystemWatcher(
      new RelativePattern(root, "**"),
    );
  }

  dispose() {
    this.positDir?.dispose();
    this.publishDir?.dispose();
    this.configurations?.dispose();
    this.deploymentsDir?.dispose();
    this.deployments?.dispose();
    this.allFiles?.dispose();
  }
}
