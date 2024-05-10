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
  const selectedCredential = ref<Credential>();
  const easyDeployExpanded = ref(false);

  const lastDeploymentResult = ref<string>();
  const lastDeploymentMsg = ref<string>();

  const includedFiles = ref<DeploymentFile[]>([]);
  const excludedFiles = ref<DeploymentFile[]>([]);

  const pythonProject = ref<boolean>(false);
  const pythonPackages = ref<string[]>();
  const pythonPackageFile = ref<string>();
  const pythonPackageManager = ref<string>();

  const filteredCredentials = computed(() => {
    return credentials.value.filter((c) => {
      return (
        c.url.toLowerCase() ===
        selectedDeployment.value?.serverUrl.toLowerCase()
      );
    });
  });

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

  /**
   * Updates the selected credential to the one with the given name.
   * If the named credential is not found, the selected credential is set to undefined.
   *
   * @param name the name of the new credential to select
   * @returns true if the selected credential was the same, false if not
   */
  function updateSelectedCredentialByName(name: string) {
    const previousSelectedAccount = selectedCredential.value;

    const credential = credentials.value.find((c) => c.name === name);

    selectedCredential.value = credential;
    return previousSelectedAccount === selectedCredential.value;
  }

  const updateCredentialsAndConfigurationForDeployment = () => {
    filterCredentialsToDeployment();
    if (selectedDeployment.value?.configurationName) {
      updateSelectedConfigurationByName(
        selectedDeployment.value?.configurationName,
      );
    }
  };

  // TODO: We need to show an error when you have no credentials which can get to
  // the deployment URL
  // OR
  // Should we filter deployment list to just include what you can access. Maybe disable others?

  const filterCredentialsToDeployment = () => {
    if (filteredCredentials.value.length === 0) {
      // TODO: Show ERROR HERE!!!!
      selectedCredential.value = undefined;
    } else if (!selectedCredential.value) {
      selectedCredential.value = filteredCredentials.value[0];
    } else if (selectedCredential.value) {
      let target: Credential | undefined = filteredCredentials.value.find(
        (account) => {
          if (selectedCredential.value) {
            return account.name === selectedCredential.value.name;
          }
          return false;
        },
      );
      if (target) {
        selectedCredential.value = target;
      } else {
        selectedCredential.value = filteredCredentials.value[0];
      }
    }
  };

  watch([selectedConfiguration, selectedCredential], () =>
    updateParentViewSelectionState(),
  );

  const updateParentViewSelectionState = () => {
    const hostConduit = useHostConduitService();
    hostConduit.sendMsg({
      kind: WebviewToHostMessageType.SAVE_SELECTION_STATE,
      content: {
        state: {
          deploymentName: selectedDeployment.value?.saveName,
          configurationName: selectedConfiguration.value?.configurationName,
          credentialName: selectedCredential.value?.name,
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
    selectedCredential,
    easyDeployExpanded,
    includedFiles,
    excludedFiles,
    filteredCredentials,
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
    updateSelectedCredentialByName,
    updateCredentialsAndConfigurationForDeployment,
    updateParentViewSelectionState,
    filterCredentialsToDeployment,
    updatePythonPackages,
  };
});
