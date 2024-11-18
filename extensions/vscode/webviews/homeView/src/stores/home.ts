import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import { useHostConduitService } from "../../src/HostConduitService";
import { normalizeURL } from "../../../../src/utils/url";

import {
  Credential,
  ContentRecord,
  PreContentRecord,
  Configuration,
  ContentRecordFile,
  ConfigurationError,
} from "../../../../src/api";
import { isConfigurationError } from "../../../../src/api/types/configurations";
import { WebviewToHostMessageType } from "../../../../src/types/messages/webviewToHostMessages";
import { RPackage } from "../../../../src/api/types/packages";
import { DeploymentSelector } from "../../../../src/types/shared";
import { splitFilesOnInclusion } from "src/utils/files";
import {
  isAgentErrorInvalidTOML,
  isAgentErrorTypeUnknown,
} from "../../../../src/api/types/error";

export const useHomeStore = defineStore("home", () => {
  const platformFileSeparator = ref<string>("/");
  const publishInProgress = ref(false);

  const contentRecords = ref<(ContentRecord | PreContentRecord)[]>([]);
  const configurations = ref<Configuration[]>([]);
  const configurationsInError = ref<ConfigurationError[]>([]);
  const credentials = ref<Credential[]>([]);
  const sortedCredentials = computed(() => {
    return credentials.value.sort((a, b) => a.name.localeCompare(b.name));
  });

  const serverSecrets = ref<Set<string>>(new Set());
  const secrets = ref(new Map<string, string | undefined>());

  const environment = computed((): Map<string, string> => {
    const result = new Map<string, string>();
    const config = selectedConfiguration.value;

    if (config === undefined || isConfigurationError(config)) {
      return result;
    }

    Object.entries(config.configuration.environment || {}).forEach(
      ([name, value]) => {
        result.set(name, value);
      },
    );

    return result;
  });

  const duplicatedEnvironmentVariables = computed((): string[] => {
    const result: string[] = [];
    secrets.value.forEach((_, name) => {
      if (environment.value.has(name)) {
        result.push(name);
      }
    });
    return result;
  });

  const showDisabledOverlay = ref(false);

  const selectedContentRecord = ref<ContentRecord | PreContentRecord>();

  // Always use the content record as the source of truth for the
  // configuration. Can be undefined if a Configuration is not specified or
  // found.
  const selectedConfiguration = computed(
    (): Configuration | ConfigurationError | undefined => {
      if (!selectedContentRecord.value) {
        return undefined;
      }
      const { configurationName, projectDir } = selectedContentRecord.value;
      let result;
      result = configurations.value.find(
        (cfg) =>
          cfg.configurationName === configurationName &&
          cfg.projectDir === projectDir,
      );
      if (!result) {
        result = configurationsInError.value.find(
          (cfg) =>
            cfg.configurationName === configurationName &&
            cfg.projectDir === projectDir,
        );
      }
      return result;
    },
  );

  watch(
    [selectedContentRecord, selectedConfiguration],
    ([contentRecord, config], [prevContentRecord, prevConfig]) => {
      const result = new Map<string, string | undefined>();

      if (config === undefined || isConfigurationError(config)) {
        secrets.value = result;
        return;
      }

      const isSameContentRecord = Boolean(
        contentRecord?.saveName === prevContentRecord?.saveName,
      );

      config.configuration.secrets?.forEach((secret) => {
        if (isSameContentRecord && secrets.value?.has(secret)) {
          result.set(secret, secrets.value.get(secret));
        } else {
          result.set(secret, undefined);
        }
      });

      secrets.value = result;
    },
    { immediate: true },
  );

  // Always use the content record as the source of truth for the
  // credential. Can be undefined if a Credential is not specified or found.
  const serverCredential = computed(() => {
    return credentials.value.find((cfg) => {
      const credentialUrl = cfg.url.toLowerCase();
      const recordUrl = selectedContentRecord.value?.serverUrl.toLowerCase();
      if (!recordUrl) {
        return false;
      }
      return normalizeURL(credentialUrl) === normalizeURL(recordUrl);
    });
  });

  const lastContentRecordResult = ref<string>();
  const lastContentRecordMsg = ref<string>();

  const files = ref<ContentRecordFile>();

  const flatFiles = computed(() => {
    const response: {
      includedFiles: ContentRecordFile[];
      excludedFiles: ContentRecordFile[];
      lastDeployedFiles: Set<string>;
    } = { includedFiles: [], excludedFiles: [], lastDeployedFiles: new Set() };
    if (files.value) {
      splitFilesOnInclusion(files.value, response);
    }

    if (selectedContentRecord.value?.state !== "new") {
      response.lastDeployedFiles = new Set(selectedContentRecord.value?.files);
    }

    return response;
  });

  const pythonProject = ref<boolean>(false);
  const pythonPackages = ref<string[]>();
  const pythonPackageFile = ref<string>();
  const pythonPackageManager = ref<string>();

  const rProject = ref<boolean>(false);
  const rPackages = ref<RPackage[]>();
  const rPackageFile = ref<string>();
  const rPackageManager = ref<string>();
  const rVersion = ref<string>();

  const initializingRequestComplete = ref<boolean>(false);

  /**
   * Updates the selected contentRecord to one with the given name.
   * If the named contentRecord is not found, the selected contentRecord is set to undefined.
   *
   * @param name the name of the new contentRecord to select
   * @returns true if the selected contentRecord was the same, false if not
   */
  function updateSelectedContentRecordBySelector(
    selector?: DeploymentSelector,
  ) {
    const previousSelectedContentRecord = selectedContentRecord.value;
    const previousSelectedConfig = selectedConfiguration.value;

    const contentRecord = contentRecords.value.find(
      (d) => d.deploymentPath === selector?.deploymentPath,
    );

    selectedContentRecord.value = contentRecord;

    return (
      previousSelectedContentRecord === selectedContentRecord.value &&
      previousSelectedConfig === selectedConfiguration.value
    );
  }

  function updateSelectedContentRecordByObject(
    contentRecord: ContentRecord | PreContentRecord,
  ) {
    contentRecords.value.push(contentRecord);
    selectedContentRecord.value = contentRecord;
  }

  watch([selectedConfiguration], () => updateParentViewSelectionState());

  const updateParentViewSelectionState = () => {
    const hostConduit = useHostConduitService();
    // skip saving the selection if we have not yet
    // selected a content record. This is probably an init
    // sequence.
    if (selectedContentRecord.value) {
      const state = {
        deploymentName: selectedContentRecord.value.saveName,
        projectDir: selectedContentRecord.value.projectDir,
        configurationName: selectedConfiguration.value?.configurationName,
        deploymentPath: selectedContentRecord.value.deploymentPath,
      };
      hostConduit.sendMsg({
        kind: WebviewToHostMessageType.SAVE_SELECTION_STATE,
        content: {
          state,
        },
      });
    }
  };

  const updatePythonPackages = (
    ispythonProject: boolean,
    packages?: string[],
    file?: string,
    manager?: string,
  ) => {
    pythonProject.value = ispythonProject;
    pythonPackages.value = packages;
    pythonPackageFile.value = file;
    pythonPackageManager.value = manager;
  };

  const updateRPackages = (
    isRProject: boolean,
    packages?: RPackage[],
    file?: string,
    manager?: string,
    version?: string,
  ) => {
    rProject.value = isRProject;
    rPackages.value = packages;
    rPackageFile.value = file;
    rPackageManager.value = manager;
    rVersion.value = version;
  };

  const clearSecretValues = () => {
    const cleared = new Map();

    secrets.value.forEach((_, key) => {
      cleared.set(key, undefined);
    });

    secrets.value = cleared;
  };

  const secretsWithValueCount = computed(() => {
    return Array.from(secrets.value.values()).filter((v) => v !== undefined)
      .length;
  });

  const python = {
    active: {
      isEmptyRequirements: computed(() => {
        return (
          pythonProject.value &&
          pythonPackageFile.value &&
          pythonPackages.value &&
          pythonPackages.value.length === 0
        );
      }),
      isMissingRequirements: computed(() => {
        return pythonProject.value && !pythonPackageFile.value;
      }),
      isAlertActive: computed((): Boolean => {
        return (
          python.active.isEmptyRequirements.value ||
          python.active.isMissingRequirements.value
        );
      }),
      isInProject: computed(() => {
        return pythonProject;
      }),
    },
  };

  const r = {
    active: {
      isMissingPackageFile: computed(() => {
        return rProject.value && !rPackageFile.value;
      }),

      isEmptyRequirements: computed(() => {
        return Boolean(
          rProject.value &&
            rPackageFile.value &&
            rPackages.value &&
            rPackages.value.length === 0,
        );
      }),

      isAlertActive: computed((): boolean => {
        return (
          r.active.isMissingPackageFile.value ||
          r.active.isEmptyRequirements.value
        );
      }),

      isInProject: computed(() => {
        return rProject.value;
      }),
    },
  };

  const credential = {
    isAvailable: computed(() => {
      return Boolean(sortedCredentials.value.length);
    }),

    active: {
      isMissing: computed(() => {
        return config.active.isCredentialMissing.value;
      }),

      isAlertActive: computed((): boolean => {
        return credential.active.isMissing.value;
      }),
    },
  };

  const anyActiveAlerts = computed(() => {
    return (
      !config.active.isAlertActive.value &&
      (credential.active.isAlertActive.value ||
        r.active.isAlertActive.value ||
        python.active.isAlertActive.value)
    );
  });

  const config = {
    active: {
      isEntryMissing: computed(() => {
        return Boolean(
          selectedContentRecord.value &&
            !selectedContentRecord.value.configurationName,
        );
      }),

      isMissing: computed((): boolean => {
        return Boolean(
          selectedContentRecord.value &&
            !selectedConfiguration.value &&
            !config.active.isInErrorList(
              selectedContentRecord.value?.configurationName,
            ) &&
            !config.active.isEntryMissing.value,
        );
      }),

      isTOMLError: computed((): boolean => {
        return Boolean(
          selectedConfiguration.value &&
            isConfigurationError(selectedConfiguration.value) &&
            isAgentErrorInvalidTOML(selectedConfiguration.value.error),
        );
      }),

      isUnknownError: computed((): boolean => {
        return Boolean(
          selectedConfiguration.value &&
            isConfigurationError(selectedConfiguration.value) &&
            isAgentErrorTypeUnknown(selectedConfiguration.value.error),
        );
      }),

      isInErrorList: (configName?: string): boolean => {
        if (!configName) {
          return false;
        }
        return Boolean(
          configurationsInError.value.find(
            (config) =>
              config.configurationName ===
              selectedContentRecord.value?.configurationName,
          ),
        );
      },

      isCredentialMissing: computed((): boolean => {
        return Boolean(selectedContentRecord.value && !serverCredential.value);
      }),

      isAlertActive: computed((): boolean => {
        return (
          config.active.isEntryMissing.value ||
          config.active.isMissing.value ||
          config.active.isTOMLError.value ||
          config.active.isUnknownError.value ||
          config.active.isCredentialMissing.value
        );
      }),
    },
  };

  return {
    platformFileSeparator,
    showDisabledOverlay,
    publishInProgress,
    contentRecords,
    configurations,
    configurationsInError,
    credentials,
    sortedCredentials,
    serverSecrets,
    secrets,
    environment,
    duplicatedEnvironmentVariables,
    selectedContentRecord,
    selectedConfiguration,
    serverCredential,
    files,
    flatFiles,
    initializingRequestComplete,
    lastContentRecordResult,
    lastContentRecordMsg,
    pythonProject,
    pythonPackages,
    pythonPackageFile,
    pythonPackageManager,
    rProject,
    rPackages,
    rPackageFile,
    anyActiveAlerts,
    updateSelectedContentRecordBySelector,
    updateSelectedContentRecordByObject,
    updateParentViewSelectionState,
    updatePythonPackages,
    updateRPackages,
    clearSecretValues,
    secretsWithValueCount,
    python,
    r,
    config,
    credential,
  };
});
