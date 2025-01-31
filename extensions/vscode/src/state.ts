// Copyright (C) 2024 by Posit Software, PBC.

import { Disposable, Memento, window } from "vscode";

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
import { showProgress } from "src/utils/progress";
import {
  getStatusFromError,
  getSummaryStringFromError,
} from "src/utils/errors";
import {
  isErrCredentialsCorrupted,
  errCredentialsCorruptedMessage,
  isErrCannotBackupCredentialsFile,
  errCannotBackupCredentialsFileMessage,
} from "src/utils/errorTypes";
import { DeploymentSelector, SelectionState } from "src/types/shared";
import { LocalState, Views } from "./constants";
import { getPythonInterpreterPath, getRInterpreterPath } from "./utils/vscode";

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
    (cfg) => cfg.configurationName === name && cfg.projectDir === projectDir,
  );
}

function findCredential(
  name: string,
  creds: Credential[],
): Credential | undefined {
  return creds.find((cfg) => cfg.name === name);
}

function findCredentialForContentRecord(
  contentRecord: ContentRecord | PreContentRecord | PreContentRecordWithConfig,
  creds: Credential[],
): Credential | undefined {
  return creds.find(
    (cfg) =>
      normalizeURL(cfg.url).toLowerCase() ===
      normalizeURL(contentRecord.serverUrl).toLowerCase(),
  );
}

/**
 * Local extension context interface containing only what is used by PublisherState
 */
interface extensionContext {
  // A memento object that stores state in the context
  readonly workspaceState: Memento;
}

export class PublisherState implements Disposable {
  private readonly context: extensionContext;

  contentRecords: Array<
    ContentRecord | PreContentRecord | PreContentRecordWithConfig
  > = [];
  configurations: Array<Configuration | ConfigurationError> = [];
  credentials: Credential[] = [];

  constructor(context: extensionContext) {
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
        // its not foolproof, but it may help
        if (!this.findContentRecord(cr.saveName, cr.projectDir)) {
          this.contentRecords.push(cr);
        }
        return cr;
      }
      return undefined;
    } catch (error: unknown) {
      const code = getStatusFromError(error);
      if (code !== 404) {
        // 404 is expected when doesn't exist on disk
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

  updateContentRecord(
    newValue: ContentRecord | PreContentRecord | PreContentRecordWithConfig,
  ) {
    const existingContentRecord = this.findContentRecord(
      newValue.saveName,
      newValue.projectDir,
    );
    if (existingContentRecord) {
      const crIndex = this.contentRecords.findIndex(
        (contentRecord) =>
          contentRecord.deploymentPath === existingContentRecord.deploymentPath,
      );
      if (crIndex !== -1) {
        this.contentRecords[crIndex] = newValue;
      } else {
        this.contentRecords.push(newValue);
      }
    }
  }

  async getSelectedConfiguration() {
    const contentRecord = await this.getSelectedContentRecord();
    if (!contentRecord) {
      return undefined;
    }
    const cfg = this.findValidConfig(
      contentRecord.configurationName,
      contentRecord.projectDir,
    );
    if (cfg) {
      return cfg;
    }
    // if not found, then retrieve it and add it to our cache.
    try {
      const api = await useApi();
      const python = await getPythonInterpreterPath();
      const r = await getRInterpreterPath();

      const response = await api.configurations.get(
        contentRecord.configurationName,
        contentRecord.projectDir,
        r,
        python,
      );
      const cfg = response.data;
      // its not foolproof, but it may help
      if (!this.findConfig(cfg.configurationName, cfg.projectDir)) {
        this.configurations.push(cfg);
      }
      return cfg;
    } catch (error: unknown) {
      const code = getStatusFromError(error);
      if (code !== 404) {
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
    try {
      await showProgress("Refreshing Deployments", Views.HomeView, async () => {
        const api = await useApi();
        const response = await api.contentRecords.getAll(".", {
          recursive: true,
        });

        // Currently we filter out any Content Records in error
        this.contentRecords = response.data.filter(
          (
            r,
          ): r is
            | ContentRecord
            | PreContentRecord
            | PreContentRecordWithConfig => !isContentRecordError(r),
        );
      });
    } catch (error: unknown) {
      const summary = getSummaryStringFromError("refreshContentRecords", error);
      window.showErrorMessage(summary);
    }
  }

  findContentRecord(name: string, projectDir: string) {
    return findContentRecord(name, projectDir, this.contentRecords);
  }

  findContentRecordByPath(path: string) {
    return findContentRecordByPath(path, this.contentRecords);
  }

  async refreshConfigurations() {
    try {
      await showProgress(
        "Refreshing Configurations",
        Views.HomeView,
        async () => {
          const api = await useApi();
          const python = await getPythonInterpreterPath();
          const r = await getRInterpreterPath();
          const response = await api.configurations.getAll(".", r, python, {
            recursive: true,
          });
          this.configurations = response.data;
        },
      );
    } catch (error: unknown) {
      const summary = getSummaryStringFromError("refreshConfigurations", error);
      window.showErrorMessage(summary);
    }
  }

  get validConfigs(): Configuration[] {
    return this.configurations.filter(
      (cfg): cfg is Configuration => !isConfigurationError(cfg),
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
    try {
      await showProgress("Refreshing Credentials", Views.HomeView, async () => {
        const api = await useApi();
        const response = await api.credentials.list();
        this.credentials = response.data;
      });
    } catch (error: unknown) {
      if (isErrCredentialsCorrupted(error)) {
        this.resetCredentials();
        return;
      }
      const summary = getSummaryStringFromError("refreshCredentials", error);
      window.showErrorMessage(summary);
    }
  }

  // Calls to reset all credentials data stored.
  // Meant to be a last resort when we get loading data or corrupted data errors.
  async resetCredentials() {
    try {
      const api = await useApi();
      const response = await api.credentials.reset();
      const warnMsg = errCredentialsCorruptedMessage(response.data.backupFile);
      window.showWarningMessage(warnMsg);

      const listResponse = await api.credentials.list();
      this.credentials = listResponse.data;
    } catch (err: unknown) {
      if (isErrCannotBackupCredentialsFile(err)) {
        window.showErrorMessage(errCannotBackupCredentialsFileMessage(err));
        return;
      }
      const summary = getSummaryStringFromError("resetCredentials", err);
      window.showErrorMessage(summary);
    }
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
