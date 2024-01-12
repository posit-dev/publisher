// Copyright (C) 2023 by Posit Software, PBC.

import { defineStore } from 'pinia';
import { useApi } from 'src/api';
import { computed, ref } from 'vue';
import { router } from 'src/router';
import { newFatalErrorRouteLocation } from 'src/util/errors';
import { sortByDateString } from 'src/utils/date';

import { Deployment, DeploymentRecordError, isDeploymentRecordError } from 'src/api/types/deployments';

export const useDeploymentStore = defineStore('deployment', () => {
  // key is deployment saveName
  type DeploymentMap = Record<string, Deployment | DeploymentRecordError>;

  const deploymentMap = ref<DeploymentMap>({});

  const api = useApi();

  const getDeployments = async() => {
    try {
      deploymentMap.value = {};

      // API Returns:
      // 200 - success
      // 500 - internal server error
      const response = (await api.deployments.getAll()).data;
      response.forEach((deployment) => {
        if (isDeploymentRecordError(deployment)) {
          deploymentMap.value[deployment.deploymentName] = deployment;
        } else {
          deploymentMap.value[deployment.saveName] = deployment;
        }
      });
    } catch (error: unknown) {
      router.push(newFatalErrorRouteLocation(error, 'deployments::getDeployments()'));
    }
  };

  const hasDeployments = computed(() => Object.keys(deploymentMap.value).length > 0);

  const refreshDeployment = async(deploymentName: string) => {
    try {
      // API Returns:
      // 200 - success
      // 404 - not found
      // 500 - internal server error
      const response = await api.deployments.get(deploymentName);
      const deployment = response.data;
      if (isDeploymentRecordError(deployment)) {
        deploymentMap.value[deployment.deploymentName] = deployment;
      } else {
        deploymentMap.value[deployment.saveName] = deployment;
      }
    } catch (error: unknown) {
      // For this page, we send all errors to the fatal error page, including 404
      router.push(newFatalErrorRouteLocation(error, `deployments::getDeployment(${name})`));
    }
  };

  const sortedDeployments = computed(() => {
    const result: Array<Deployment | DeploymentRecordError> = [];
    const deploymentErrors: Array<DeploymentRecordError> = [];
    const deployments: Array<Deployment> = [];
    Object.keys(deploymentMap.value).forEach(
      deploymentName => {
        const deployment = deploymentMap.value[deploymentName];
        if (isDeploymentRecordError(deployment)) {
          deploymentErrors.push(deployment);
        } else {
          deployments.push(deployment);
        }
      }
    );
    deploymentErrors.sort((a, b) => {
      return compareString(a.deploymentName, b.deploymentName);
    });
    deployments.sort((a, b) => {
      return sortByDateString(a.deployedAt, b.deployedAt);
    });

    return result.concat(deploymentErrors, deployments);
  });

  const compareString = (a: string, b: string) => {
    if (a < b){
      return -1;
    }
    if (a > b){
      return 1;
    }
    return 0;
  };

  const init = () => {
    getDeployments();
  };
  init();

  return {
    getDeployments,
    refreshDeployment,
    sortedDeployments,
    hasDeployments,
    init,
  };
});
