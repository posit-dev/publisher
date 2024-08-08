// Copyright (C) 2024 by Posit Software, PBC.

import { Disposable, ExtensionContext, window } from "vscode";

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
import { DeploymentSelector, SelectionState } from "src/types/shared";
import { LocalState } from "./constants";
import { getStatusFromError, getSummaryStringFromError } from "./utils/errors";

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

  getSelection(): DeploymentSelector | undefined {
    const savedState = this.context.workspaceState.get<SelectionState>(
      LocalState.LastSelectionState,
      null,
    );
    if (!savedState) {
      return undefined;
    }
    if (savedState.version === "v1") {
      return {
        deploymentName: savedState.deploymentName,
        deploymentPath: savedState.deploymentPath,
        projectDir: savedState.projectDir,
      };
    }
    // We don't know about this one, including the last
    // one which didn't have the version string in it.
    return undefined;
  }

  async updateSelection(state: SelectionState) {
    await this.context.workspaceState.update(
      LocalState.LastSelectionState,
      state,
    );
  }

  async getSelectedContentRecord() {
    const selection = this.getSelection();
    if (!selection) {
      return undefined;
    }
    // try finding it first within our cache
    const cr = this.findContentRecordByPath(selection.deploymentPath);
    if (cr) {
      return cr;
    }
    // if not found, then retrieve it and add it to our cache.
    try {
      const api = await useApi();

      const response = await api.contentRecords.get(
        selection.deploymentName,
        selection.projectDir,
      );
      const cr = response.data;
      if (!isContentRecordError(cr)) {
        this.contentRecords.push(cr);
        return cr;
      }
      return undefined;
    } catch (error: unknown) {
      const code = getStatusFromError(error);
      if (code !== 404) {
        // 400 is expected when doesn't exist on disk
        const summary = getSummaryStringFromError(
          "getSelectedContentRecord, contentRecords.get",
          error,
        );
        window.showInformationMessage(
          `Unable to retrieve deployment record: ${summary}`,
        );
      }
      return undefined;
    }
  }

  async getSelectedConfiguration() {
    const contentRecord = await this.getSelectedContentRecord();
    if (!contentRecord) {
      return undefined;
    }
    const c = this.findValidConfig(
      contentRecord.configurationName,
      contentRecord.projectDir,
    );
    if (c) {
      return c;
    }
    // if not found, then retrieve it and add it to our cache.
    try {
      const api = await useApi();
      const response = await api.configurations.get(
        contentRecord.configurationName,
        contentRecord.projectDir,
      );
      const c = response.data;
      this.configurations.push(c);
      return c;
    } catch (error: unknown) {
      const code = getStatusFromError(error);
      if (code !== 400) {
        // 400 is expected when doesn't exist on disk
        const summary = getSummaryStringFromError(
          "getSelectedConfiguration, contentRecords.get",
          error,
        );
        window.showInformationMessage(
          `Unable to retrieve deployment configuration: ${summary}`,
        );
      }
      return undefined;
    }
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
