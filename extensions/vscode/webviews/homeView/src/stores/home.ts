import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import { useHostConduitService } from "../../src/HostConduitService";

import {
  Credential,
  Deployment,
  PreDeployment,
  Configuration,
  DeploymentFile,
} from "../../../../src/api";
import { WebviewToHostMessageType } from "../../../../src/types/messages/webviewToHostMessages";

export const useHomeStore = defineStore("home", () => {
  const publishInProgress = ref(false);

  const deployments = ref<(Deployment | PreDeployment)[]>([]);
  const configurations = ref<Configuration[]>([]);
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

  const easyDeployExpanded = ref(false);

  const lastDeploymentResult = ref<string>();
  const lastDeploymentMsg = ref<string>();

  const includedFiles = ref<DeploymentFile[]>([]);
  const excludedFiles = ref<DeploymentFile[]>([]);

  const pythonProject = ref<boolean>(false);
  const pythonPackages = ref<string[]>();
  const pythonPackageFile = ref<string>();
  const pythonPackageManager = ref<string>();

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

  watch(easyDeployExpanded, () => {
    const hostConduit = useHostConduitService();
    hostConduit.sendMsg({
      kind: WebviewToHostMessageType.SAVE_DEPLOYMENT_BUTTON_EXPANDED,
      content: {
        expanded: easyDeployExpanded.value,
      },
    });
  });

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

  return {
    publishInProgress,
    deployments,
    configurations,
    credentials,
    selectedDeployment,
    selectedConfiguration,
    serverCredential,
    easyDeployExpanded,
    includedFiles,
    excludedFiles,
    lastDeploymentResult,
    lastDeploymentMsg,
    pythonProject,
    pythonPackages,
    pythonPackageFile,
    pythonPackageManager,
    updateSelectedDeploymentByName,
    updateSelectedDeploymentByObject,
    updateSelectedConfigurationByName,
    updateSelectedConfigurationByObject,
    updateCredentialsAndConfigurationForDeployment,
    updateParentViewSelectionState,
    updatePythonPackages,
  };
});
