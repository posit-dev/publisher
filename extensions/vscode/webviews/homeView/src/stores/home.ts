import { computed, ref } from "vue";
import { defineStore } from "pinia";

import {
  Deployment,
  PreDeployment,
  Account,
  Configuration,
} from "../../../../src/api";

export const useHomeStore = defineStore("home", () => {
  const publishInProgress = ref(false);

  const deployments = ref<(Deployment | PreDeployment)[]>([]);
  const configurations = ref<Configuration[]>([]);
  const credentials = ref<Account[]>([]);

  const selectedDeployment = ref<Deployment | PreDeployment>();
  const selectedConfiguration = ref<Configuration>();
  const selectedCredential = ref<Account>();

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

  return {
    publishInProgress,
    deployments,
    configurations,
    credentials,
    selectedDeployment,
    selectedConfiguration,
    selectedCredential,
    filteredCredentials,
    updateSelectedDeploymentByName,
    updateSelectedDeploymentByObject,
    updateSelectedConfigurationByName,
    updateSelectedConfigurationByObject,
    updateSelectedCredentialByName,
  };
});
