// Copyright (C) 2024 by Posit Software, PBC.

import {
  Disposable,
  RelativePattern,
  FileSystemWatcher,
  workspace,
  Uri,
} from "vscode";

import { Configuration, ContentRecordLocation } from "src/api";
import {
  PUBLISH_DEPLOYMENTS_FOLDER,
  POSIT_FOLDER,
  PUBLISH_FOLDER,
  CONFIGURATIONS_PATTERN,
  DEPLOYMENTS_PATTERN,
  DEFAULT_PYTHON_PACKAGE_FILE,
  DEFAULT_R_PACKAGE_FILE,
} from "src/constants";
import { relativePath } from "./utils/files";

/**
 * Manages persistent file system watchers for the extension.
 *
 * The directory watchers only watch for onDidDelete events.
 */
export class WatcherManager implements Disposable {
  positDir: FileSystemWatcher | undefined;
  publishDir: FileSystemWatcher | undefined;
  configurations: FileSystemWatcher | undefined;
  contentRecordsDir: FileSystemWatcher | undefined;
  contentRecords: FileSystemWatcher | undefined;
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

    this.contentRecordsDir = workspace.createFileSystemWatcher(
      new RelativePattern(root, PUBLISH_DEPLOYMENTS_FOLDER),
      true,
      true,
      false,
    );

    this.contentRecords = workspace.createFileSystemWatcher(
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
    this.contentRecordsDir?.dispose();
    this.contentRecords?.dispose();
    this.allFiles?.dispose();
  }
}

/**
 *  Manages file watchers for a specific Content Record
 */
export class ContentRecordWatcherManager implements Disposable {
  contentRecord: FileSystemWatcher | undefined;

  constructor(location?: ContentRecordLocation) {
    const root = workspace.workspaceFolders?.[0];
    if (root === undefined || location === undefined) {
      return;
    }

    const relPath = relativePath(Uri.file(location.deploymentPath));
    if (relPath) {
      this.contentRecord = workspace.createFileSystemWatcher(
        new RelativePattern(root, relPath),
      );
    }
  }

  dispose() {
    this.contentRecord?.dispose();
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
        Uri.joinPath(root.uri, cfg.projectDir),
        cfg.configuration.python?.packageFile || DEFAULT_PYTHON_PACKAGE_FILE,
      ),
    );

    this.rPackageFile = workspace.createFileSystemWatcher(
      new RelativePattern(
        Uri.joinPath(root.uri, cfg.projectDir),
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
