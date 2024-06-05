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
  function updateSelectedContentRecordByName(name: string) {
    const previousSelectedContentRecord = selectedContentRecord.value;

    const contentRecord = contentRecords.value.find(
      (d) => d.deploymentName === name,
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
  function updateSelectedConfigurationByName(name: string) {
    const previousSelectedConfig = selectedConfiguration.value;

    const config = configurations.value.find(
      (c) => c.configurationName === name,
    );

    selectedConfiguration.value = config;
    return previousSelectedConfig === selectedConfiguration.value;
  }

  function updateSelectedConfigurationByObject(config: Configuration) {
    configurations.value.push(config);
    selectedConfiguration.value = config;
  }

  const updateCredentialsAndConfigurationForContentRecord = () => {
    if (selectedContentRecord.value?.configurationName) {
      updateSelectedConfigurationByName(
        selectedContentRecord.value?.configurationName,
      );
    }
  };

  watch([selectedConfiguration], () => updateParentViewSelectionState());

  const updateParentViewSelectionState = () => {
    const hostConduit = useHostConduitService();
    hostConduit.sendMsg({
      kind: WebviewToHostMessageType.SAVE_SELECTION_STATE,
      content: {
        state: {
          deploymentName: selectedContentRecord.value?.saveName,
          configurationName: selectedConfiguration.value?.configurationName,
        },
      },
    });
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
    updateSelectedContentRecordByName,
    updateSelectedContentRecordByObject,
    updateSelectedConfigurationByName,
    updateSelectedConfigurationByObject,
    updateCredentialsAndConfigurationForContentRecord,
    updateParentViewSelectionState,
    updatePythonPackages,
    updateRPackages,
  };
});
