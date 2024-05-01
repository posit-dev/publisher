import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import { useHostConduitService } from "../../src/HostConduitService";

import {
  Deployment,
  PreDeployment,
  Account,
  Configuration,
  DeploymentFile,
} from "../../../../src/api";
import { WebviewToHostMessageType } from "../../../../src/types/messages/webviewToHostMessages";

export const useHomeStore = defineStore("home", () => {
  const publishInProgress = ref(false);

  const deployments = ref<(Deployment | PreDeployment)[]>([]);
  const configurations = ref<Configuration[]>([]);
  const credentials = ref<Account[]>([]);

  const selectedDeployment = ref<Deployment | PreDeployment>();
  const selectedConfiguration = ref<Configuration>();
  const selectedCredential = ref<Account>();
  const easyDeployExpanded = ref(false);

  const lastDeploymentResult = ref<string>();
  const lastDeploymentMsg = ref<string>();

  const includedFiles = ref<DeploymentFile[]>([]);
  const excludedFiles = ref<DeploymentFile[]>([]);

  const pythonPackages = ref<string[] | undefined>(undefined);
  const pythonPackageFile = ref<string | undefined>(undefined);
  const pythonPackageManager = ref<string | undefined>(undefined);

  const filteredCredentials = computed(() => {
    return credentials.value.filter((c) => {
      return (
        c.url.toLowerCase() ===
        selectedDeployment.value?.serverUrl.toLowerCase()
      );
    });
  });

  function updateSelectedDeploymentByName(name?: string) {
    const previousSelectedDeployment = selectedDeployment.value;
    let selectedDeploymentTarget: Deployment | PreDeployment | undefined =
      undefined;
    if (name) {
      selectedDeploymentTarget = deployments.value.find(
        (d) => d.deploymentName === name,
      );
    }
    if (!selectedDeploymentTarget && deployments.value.length) {
      selectedDeploymentTarget = deployments.value[0];
    }
    selectedDeployment.value = selectedDeploymentTarget;
    return previousSelectedDeployment === selectedDeployment.value;
  }

  function updateSelectedDeploymentByObject(
    deployment: Deployment | PreDeployment,
  ) {
    deployments.value.push(deployment);
    selectedDeployment.value = deployment;
  }

  function updateSelectedConfigurationByName(name?: string) {
    const previousSelectedConfig = selectedConfiguration.value;
    let selectedConfigTarget: Configuration | undefined = undefined;
    if (name) {
      selectedConfigTarget = configurations.value.find(
        (c) => c.configurationName === name,
      );
    }
    if (!selectedConfigTarget && configurations.value.length) {
      selectedConfigTarget = configurations.value[0];
    }
    selectedConfiguration.value = selectedConfigTarget;
    return previousSelectedConfig === selectedConfiguration.value;
  }

  function updateSelectedConfigurationByObject(config: Configuration) {
    configurations.value.push(config);
    selectedConfiguration.value = config;
  }

  function updateSelectedCredentialByName(name?: string) {
    const previousSelectedAccount = selectedCredential.value;
    let selectedCredentialTarget: Account | undefined = undefined;
    if (name) {
      selectedCredentialTarget = credentials.value.find((c) => c.name === name);
    }
    if (!selectedCredentialTarget && credentials.value.length) {
      selectedCredentialTarget = credentials.value[0];
    }
    selectedCredential.value = selectedCredentialTarget;
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
      let targetAccount: Account | undefined = filteredCredentials.value.find(
        (account) => {
          if (selectedCredential.value) {
            return account.name === selectedCredential.value.name;
          }
          return false;
        },
      );
      if (targetAccount) {
        selectedCredential.value = targetAccount;
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
    packages = <string[] | undefined>undefined,
    file = <string | undefined>undefined,
    manager = <string | undefined>undefined,
  ) => {
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
