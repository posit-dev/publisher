// Copyright (C) 2024 by Posit Software, PBC.

import {
  Disposable,
  RelativePattern,
  FileSystemWatcher,
  workspace,
} from "vscode";

import { Configuration } from "src/api";
import {
  PUBLISH_DEPLOYMENTS_FOLDER,
  POSIT_FOLDER,
  PUBLISH_FOLDER,
  CONFIGURATIONS_PATTERN,
  DEPLOYMENTS_PATTERN,
  DEFAULT_PYTHON_PACKAGE_FILE,
  DEFAULT_R_PACKAGE_FILE,
} from "src/constants";

/**
 * Manages persistent file system watchers for the extension.
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

  constructor() {
    const root = workspace.workspaceFolders?.[0];
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

/**
 * Manages file watchers for a specific Configuration File
 */
export class ConfigWatcherManager implements Disposable {
  configFile: FileSystemWatcher | undefined;
  pythonPackageFile: FileSystemWatcher | undefined;
  rPackageFile: FileSystemWatcher | undefined;

  constructor(cfg?: Configuration) {
    const root = workspace.workspaceFolders?.[0];
    if (root === undefined || cfg === undefined) {
      return;
    }

    this.configFile = workspace.createFileSystemWatcher(
      new RelativePattern(root, cfg.configurationPath),
    );

    this.pythonPackageFile = workspace.createFileSystemWatcher(
      new RelativePattern(
        root,
        cfg.configuration.python?.packageFile || DEFAULT_PYTHON_PACKAGE_FILE,
      ),
    );

    this.rPackageFile = workspace.createFileSystemWatcher(
      new RelativePattern(
        root,
        cfg.configuration.r?.packageFile || DEFAULT_R_PACKAGE_FILE,
      ),
    );
  }

  dispose() {
    this.configFile?.dispose();
    this.pythonPackageFile?.dispose();
    this.rPackageFile?.dispose();
  }
}
