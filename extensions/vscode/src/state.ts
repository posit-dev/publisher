// Copyright (C) 2025 by Posit Software, PBC.

import path from "node:path";

import {
  Disposable,
  env,
  Event,
  EventEmitter,
  Memento,
  SecretStorage,
  window,
} from "vscode";

import {
  Configuration,
  ConfigurationError,
  ContentRecord,
  Credential,
  isConfigurationError,
  isContentRecordError,
  PreContentRecord,
  PreContentRecordWithConfig,
  ServerType,
  UpdateAllConfigsWithDefaults,
  UpdateConfigWithDefaults,
  useApi,
} from "src/api";
import { normalizeURL } from "src/utils/url";
import { getInterpreterDefaults } from "src/interpreters";
import { showProgress } from "src/utils/progress";
import { getSummaryStringFromError } from "src/utils/errors";
import {
  isErrCredentialsCorrupted,
  errCredentialsCorruptedMessage,
  isErrCannotBackupCredentialsFile,
  errCannotBackupCredentialsFileMessage,
} from "src/utils/errorTypes";
import {
  loadConfiguration,
  loadAllConfigurationsRecursive,
  ConfigurationLoadError,
  loadDeployment,
  loadAllDeploymentsRecursive,
} from "src/toml";
import * as workspaces from "src/workspaces";
import { DeploymentSelector, SelectionState } from "src/types/shared";
import { LocalState, Views } from "./constants";
import { getPythonInterpreterPath, getRInterpreterPath } from "./utils/vscode";
import {
  getProductType,
  isConnectCloudProduct,
} from "./utils/multiStepHelpers";
import { recordAddConnectCloudUrlParams } from "./utils/connectCloudHelpers";
import { syncAllCredentials } from "./credentialSecretStorage";

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
  const serverType = contentRecord.serverType || ServerType.CONNECT;
  const productType = getProductType(serverType);
  if (isConnectCloudProduct(productType)) {
    return creds.find(
      (c) => c.accountName === contentRecord.connectCloud?.accountName,
    );
  }
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
  // Secret storage for credential migration
  readonly secrets: SecretStorage;
}

export interface CredentialRefreshEvent {
  readonly oldCredentials: Credential[];
}

export class PublisherState implements Disposable {
  private readonly context: extensionContext;
  private credentialRefresh = new EventEmitter<CredentialRefreshEvent>();

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
      const root = workspaces.path();
      if (!root) {
        return undefined;
      }
      const loaded = await loadDeployment(
        selection.deploymentName,
        selection.projectDir,
        root,
      );
      const cr = recordAddConnectCloudUrlParams(loaded, env.appName);
      if (!isContentRecordError(cr)) {
        // its not foolproof, but it may help
        if (!this.findContentRecord(cr.saveName, cr.projectDir)) {
          this.contentRecords.push(cr);
        }
        return cr;
      }
      return undefined;
    } catch (error: unknown) {
      // ENOENT is expected when file doesn't exist on disk
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return undefined;
      }
      const summary = getSummaryStringFromError(
        "getSelectedContentRecord, loadDeployment",
        error,
      );
      window.showInformationMessage(
        `Unable to retrieve deployment record: ${summary}`,
      );
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
      const root = workspaces.path();
      if (!root) {
        return undefined;
      }
      const cfg = await loadConfiguration(
        contentRecord.configurationName,
        contentRecord.projectDir,
        root,
      );

      const python = await getPythonInterpreterPath();
      const r = await getRInterpreterPath();
      const defaults = await getInterpreterDefaults(
        path.join(root, contentRecord.projectDir),
        python?.pythonPath,
        r?.rPath,
      );
      const updated = UpdateConfigWithDefaults(cfg, defaults);
      // its not foolproof, but it may help
      if (!this.findConfig(updated.configurationName, updated.projectDir)) {
        this.configurations.push(updated);
      }
      return updated;
    } catch (error: unknown) {
      // ENOENT is expected when file doesn't exist on disk
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return undefined;
      }
      // ConfigurationLoadError means the file exists but is invalid
      if (error instanceof ConfigurationLoadError) {
        return undefined;
      }
      const summary = getSummaryStringFromError(
        "getSelectedConfiguration",
        error,
      );
      window.showInformationMessage(
        `Unable to retrieve deployment configuration: ${summary}`,
      );
      return undefined;
    }
  }

  async refreshContentRecords() {
    try {
      await showProgress("Refreshing Deployments", Views.HomeView, async () => {
        const root = workspaces.path();
        if (!root) {
          return;
        }
        const allRecords = await loadAllDeploymentsRecursive(root, root);
        const contentRecords = allRecords.map((record) =>
          recordAddConnectCloudUrlParams(record, env.appName),
        );
        // Currently we filter out any Content Records in error
        this.contentRecords = contentRecords.filter(
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
          const root = workspaces.path();
          if (!root) {
            return;
          }

          const python = await getPythonInterpreterPath();
          const r = await getRInterpreterPath();

          const configs = await loadAllConfigurationsRecursive(root);
          const defaults = await getInterpreterDefaults(
            root,
            python?.pythonPath,
            r?.rPath,
          );
          this.configurations = UpdateAllConfigsWithDefaults(configs, defaults);
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

  get onDidRefreshCredentials(): Event<CredentialRefreshEvent> {
    return this.credentialRefresh.event;
  }

  async refreshCredentials() {
    const oldCredentials = this.credentials;
    try {
      await showProgress("Refreshing Credentials", Views.HomeView, async () => {
        const api = await useApi();
        const response = await api.credentials.list();
        this.credentials = response.data;
      });
      await syncAllCredentials(this.context.secrets, this.credentials);
      this.credentialRefresh.fire({ oldCredentials: oldCredentials });
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
    const oldCredentials = this.credentials;
    try {
      const api = await useApi();
      const response = await api.credentials.reset();
      const warnMsg = errCredentialsCorruptedMessage(response.data.backupFile);
      window.showWarningMessage(warnMsg);

      const listResponse = await api.credentials.list();
      this.credentials = listResponse.data;
      await syncAllCredentials(this.context.secrets, this.credentials);
      this.credentialRefresh.fire({ oldCredentials: oldCredentials });
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
