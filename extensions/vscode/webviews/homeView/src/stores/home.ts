import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import { useHostConduitService } from "../../src/HostConduitService";

import {
  Credential,
  Deployment,
  PreDeployment,
  Configuration,
  DeploymentFile,
  ConfigurationError,
} from "../../../../src/api";
import { WebviewToHostMessageType } from "../../../../src/types/messages/webviewToHostMessages";
import { RRequirement } from "../../../../src/api/types/requirements";

export const useHomeStore = defineStore("home", () => {
  const publishInProgress = ref(false);

  const deployments = ref<(Deployment | PreDeployment)[]>([]);
  const configurations = ref<Configuration[]>([]);
  const configurationsInError = ref<ConfigurationError[]>([]);
  const credentials = ref<Credential[]>([]);

  const selectedDeployment = ref<Deployment | PreDeployment>();
  const selectedConfiguration = ref<Configuration>();

  const serverCredential = computed(() => {
    return credentials.value.find((c) => {
      return (
        c.url.toLowerCase() ===
        selectedDeployment.value?.serverUrl.toLowerCase()
      );
    });
  });

  const lastDeploymentResult = ref<string>();
  const lastDeploymentMsg = ref<string>();

  const includedFiles = ref<DeploymentFile[]>([]);
  const excludedFiles = ref<DeploymentFile[]>([]);

  const pythonProject = ref<boolean>(false);
  const pythonPackages = ref<string[]>();
  const pythonPackageFile = ref<string>();
  const pythonPackageManager = ref<string>();

  const rProject = ref<boolean>(false);
  const rPackages = ref<RRequirement[]>();
  const rPackageFile = ref<string>();
  const rPackageManager = ref<string>();
  const rVersion = ref<string>();

  /**
   * Updates the selected deployment to one with the given name.
   * If the named deployment is not found, the selected deployment is set to undefined.
   *
   * @param name the name of the new deployment to select
   * @returns true if the selected deployment was the same, false if not
   */
  function updateSelectedDeploymentByName(name: string) {
    const previousSelectedDeployment = selectedDeployment.value;

    const deployment = deployments.value.find((d) => d.deploymentName === name);

    selectedDeployment.value = deployment;
    return previousSelectedDeployment === selectedDeployment.value;
  }

  function updateSelectedDeploymentByObject(
    deployment: Deployment | PreDeployment,
  ) {
    deployments.value.push(deployment);
    selectedDeployment.value = deployment;
  }

  /**
   * Updates the selected configuration to the one with the given name.
   * If the named configuration is not found, the selected deployment is set to undefined.
   *
   * @param name the name of the new configuration to select
   * @returns true if the selected deployment was the same, false if not
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

  const updateCredentialsAndConfigurationForDeployment = () => {
    if (selectedDeployment.value?.configurationName) {
      updateSelectedConfigurationByName(
        selectedDeployment.value?.configurationName,
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
          deploymentName: selectedDeployment.value?.saveName,
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
    packages?: RRequirement[],
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
    deployments,
    configurations,
    configurationsInError,
    credentials,
    selectedDeployment,
    selectedConfiguration,
    serverCredential,
    includedFiles,
    excludedFiles,
    lastDeploymentResult,
    lastDeploymentMsg,
    pythonProject,
    pythonPackages,
    pythonPackageFile,
    pythonPackageManager,
    rProject,
    rPackages,
    rPackageFile,
    updateSelectedDeploymentByName,
    updateSelectedDeploymentByObject,
    updateSelectedConfigurationByName,
    updateSelectedConfigurationByObject,
    updateCredentialsAndConfigurationForDeployment,
    updateParentViewSelectionState,
    updatePythonPackages,
    updateRPackages,
  };
});
