import { Disposable } from "vscode";

import {
  Configuration,
  ConfigurationError,
  ContentRecord,
  Credential,
  isConfigurationError,
  PreContentRecord,
  PreContentRecordWithConfig,
  useApi,
} from "src/api";

// function findContentRecord<
//   T extends ContentRecord | PreContentRecord | PreContentRecordWithConfig,
// >(name: string, projectDir: string, records: T[]): T | undefined {
//   return records.find(
//     (r) => r.saveName === name && r.projectDir === projectDir,
//   );
// }

function findConfiguration<T extends Configuration | ConfigurationError>(
  name: string,
  projectDir: string,
  configs: Array<T>,
): T | undefined {
  return configs.find(
    (c) => c.configurationName === name && c.projectDir === projectDir,
  );
}

// function findCredential(
//   name: string,
//   creds: Credential[],
// ): Credential | undefined {
//   return creds.find((c) => c.name === name);
// }

export class PublisherState implements Disposable {
  contentRecords: Array<
    ContentRecord | PreContentRecord | PreContentRecordWithConfig
  > = [];
  credentials: Credential[] = [];
  configurations: Array<Configuration | ConfigurationError> = [];

  dispose() {
    this.contentRecords.splice(0, this.contentRecords.length);
    this.credentials.splice(0, this.contentRecords.length);
    this.configurations.splice(0, this.contentRecords.length);
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
}
