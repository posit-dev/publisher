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
import { WebviewToHostMessageType } from "../../../../src/types/messages/webviewToHostMessages";
import { RPackage } from "../../../../src/api/types/packages";
import {
  DeploymentSelector,
  HomeViewState,
} from "../../../../src/types/shared";

export const useHomeStore = defineStore("home", () => {
  const publishInProgress = ref(false);

  const contentRecords = ref<(ContentRecord | PreContentRecord)[]>([]);
  const configurations = ref<Configuration[]>([]);
  const configurationsInError = ref<ConfigurationError[]>([]);
  const credentials = ref<Credential[]>([]);

  const selectedContentRecord = ref<ContentRecord | PreContentRecord>();
  const selectedConfiguration = ref<Configuration>();

  const serverCredential = computed(() => {
    return credentials.value.find((c) => {
      const credentialUrl = c.url.toLowerCase();
      const recordUrl = selectedContentRecord.value?.serverUrl.toLowerCase();
      if (!recordUrl) {
        return false;
      }
      return normalizeURL(credentialUrl) === normalizeURL(recordUrl);
    });
  });

  const lastContentRecordResult = ref<string>();
  const lastContentRecordMsg = ref<string>();

  const includedFiles = ref<ContentRecordFile[]>([]);
  const excludedFiles = ref<ContentRecordFile[]>([]);

  const pythonProject = ref<boolean>(false);
  const pythonPackages = ref<string[]>();
  const pythonPackageFile = ref<string>();
  const pythonPackageManager = ref<string>();

  const rProject = ref<boolean>(false);
  const rPackages = ref<RPackage[]>();
  const rPackageFile = ref<string>();
  const rPackageManager = ref<string>();
  const rVersion = ref<string>();

  /**
   * Updates the selected contentRecord to one with the given name.
   * If the named contentRecord is not found, the selected contentRecord is set to undefined.
   *
   * @param name the name of the new contentRecord to select
   * @returns true if the selected contentRecord was the same, false if not
   */
  function updateSelectedContentRecordBySelector(selector: DeploymentSelector) {
    const previousSelectedContentRecord = selectedContentRecord.value;

    const contentRecord = contentRecords.value.find(
      (d) => d.deploymentPath === selector.deploymentPath,
    );

    selectedContentRecord.value = contentRecord;
    return previousSelectedContentRecord === selectedContentRecord.value;
  }

  function updateSelectedContentRecordByObject(
    contentRecord: ContentRecord | PreContentRecord,
  ) {
    contentRecords.value.push(contentRecord);
    selectedContentRecord.value = contentRecord;
  }

  /**
   * Updates the selected configuration to the one with the given name.
   * If the named configuration is not found, the selected contentRecord is set to undefined.
   *
   * @param name the name of the new configuration to select
   * @returns true if the selected contentRecord was the same, false if not
   */
  function updateSelectedConfigurationBySelector(selector: DeploymentSelector) {
    const previousSelectedConfig = selectedConfiguration.value;

    // Always determine the selected configuration by what is in the
    // deployment file.
    const contentRecord = contentRecords.value.find(
      (d) => d.deploymentPath === selector.deploymentPath,
    );
    if (!contentRecord) {
      return false;
    }

    const config = configurations.value.find((c) => {
      return (
        c.configurationName === contentRecord.configurationName &&
        c.projectDir === contentRecord.projectDir
      );
    });

    selectedConfiguration.value = config;
    return previousSelectedConfig === selectedConfiguration.value;
  }

  function updateSelectedConfigurationByObject(config: Configuration) {
    configurations.value.push(config);
    selectedConfiguration.value = config;
  }

  const updateCredentialsAndConfigurationForContentRecord = () => {
    if (selectedContentRecord.value?.configurationName) {
      updateSelectedConfigurationBySelector(selectedContentRecord.value);
    }
  };

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

  return {
    publishInProgress,
    contentRecords,
    configurations,
    configurationsInError,
    credentials,
    selectedContentRecord,
    selectedConfiguration,
    serverCredential,
    includedFiles,
    excludedFiles,
    lastContentRecordResult,
    lastContentRecordMsg,
    pythonProject,
    pythonPackages,
    pythonPackageFile,
    pythonPackageManager,
    rProject,
    rPackages,
    rPackageFile,
    updateSelectedContentRecordBySelector,
    updateSelectedContentRecordByObject,
    updateSelectedConfigurationBySelector,
    updateSelectedConfigurationByObject,
    updateCredentialsAndConfigurationForContentRecord,
    updateParentViewSelectionState,
    updatePythonPackages,
    updateRPackages,
  };
});
