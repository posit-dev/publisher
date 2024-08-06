// Copyright (C) 2024 by Posit Software, PBC.

import { Disposable, ExtensionContext } from "vscode";

import {
  Configuration,
  ConfigurationError,
  ContentRecord,
  Credential,
  isConfigurationError,
  isContentRecordError,
  PreContentRecord,
  PreContentRecordWithConfig,
  useApi,
} from "src/api";
import { normalizeURL } from "src/utils/url";
import { SelectionState } from "src/types/shared";
import { LocalState } from "./constants";

function findContentRecord<
  T extends ContentRecord | PreContentRecord | PreContentRecordWithConfig,
>(name: string, projectDir: string, records: T[]): T | undefined {
  return records.find(
    (r) => r.saveName === name && r.projectDir === projectDir,
  );
}

function findContentRecordByPath<
  T extends ContentRecord | PreContentRecord | PreContentRecordWithConfig,
>(path: string, records: T[]): T | undefined {
  return records.find((r) => r.deploymentPath === path);
}

function findConfiguration<T extends Configuration | ConfigurationError>(
  name: string,
  projectDir: string,
  configs: Array<T>,
): T | undefined {
  return configs.find(
    (c) => c.configurationName === name && c.projectDir === projectDir,
  );
}

function findCredential(
  name: string,
  creds: Credential[],
): Credential | undefined {
  return creds.find((c) => c.name === name);
}

function findCredentialForContentRecord(
  contentRecord: ContentRecord | PreContentRecord | PreContentRecordWithConfig,
  creds: Credential[],
): Credential | undefined {
  return creds.find(
    (c) =>
      normalizeURL(c.url).toLowerCase() ===
      normalizeURL(contentRecord.serverUrl).toLowerCase(),
  );
}

export class PublisherState implements Disposable {
  private readonly context: ExtensionContext;

  contentRecords: Array<
    ContentRecord | PreContentRecord | PreContentRecordWithConfig
  > = [];
  configurations: Array<Configuration | ConfigurationError> = [];
  credentials: Credential[] = [];

  constructor(context: ExtensionContext) {
    this.context = context;
  }

  dispose() {
    this.contentRecords.splice(0, this.contentRecords.length);
    this.credentials.splice(0, this.contentRecords.length);
    this.configurations.splice(0, this.contentRecords.length);
  }

  getSelection(): SelectionState {
    return this.context.workspaceState.get<SelectionState>(
      LocalState.LastSelectionState,
      null,
    );
  }

  async updateSelection(state: SelectionState) {
    await this.context.workspaceState.update(
      LocalState.LastSelectionState,
      state,
    );
  }

  getSelectedContentRecord() {
    const selection = this.getSelection();
    if (!selection) {
      return undefined;
    }
    return this.findContentRecordByPath(selection.deploymentPath);
  }

  getSelectedConfiguration() {
    const contentRecord = this.getSelectedContentRecord();
    if (!contentRecord) {
      return undefined;
    }
    return this.findValidConfig(
      contentRecord.configurationName,
      contentRecord.projectDir,
    );
  }

  async refreshContentRecords() {
    const api = await useApi();
    const response = await api.contentRecords.getAll(".", { recursive: true });

    // Currently we filter out any Content Records in error
    this.contentRecords = response.data.filter(
      (r): r is ContentRecord | PreContentRecord | PreContentRecordWithConfig =>
        !isContentRecordError(r),
    );
  }

  findContentRecord(name: string, projectDir: string) {
    return findContentRecord(name, projectDir, this.contentRecords);
  }

  findContentRecordByPath(path: string) {
    return findContentRecordByPath(path, this.contentRecords);
  }

  async refreshConfigurations() {
    const api = await useApi();
    const response = await api.configurations.getAll(".", { recursive: true });

    this.configurations = response.data;
  }

  get validConfigs(): Configuration[] {
    return this.configurations.filter(
      (c): c is Configuration => !isConfigurationError(c),
    );
  }

  get configsInError(): ConfigurationError[] {
    return this.configurations.filter(isConfigurationError);
  }

  findConfig(name: string, projectDir: string) {
    return findConfiguration(name, projectDir, this.configurations);
  }

  findValidConfig(name: string, projectDir: string) {
    return findConfiguration(name, projectDir, this.validConfigs);
  }

  findConfigInError(name: string, projectDir: string) {
    return findConfiguration(name, projectDir, this.configsInError);
  }

  async refreshCredentials() {
    const api = await useApi();
    const response = await api.credentials.list();

    this.credentials = response.data;
  }

  findCredential(name: string) {
    return findCredential(name, this.credentials);
  }

  findCredentialForContentRecord(
    contentRecord:
      | ContentRecord
      | PreContentRecord
      | PreContentRecordWithConfig,
  ) {
    return findCredentialForContentRecord(contentRecord, this.credentials);
  }
}
