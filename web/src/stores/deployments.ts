// Copyright (C) 2023 by Posit Software, PBC.

import { defineStore } from 'pinia';
import { useApi } from 'src/api';
import { computed, ref } from 'vue';
import { router } from 'src/router';
import { getStatusFromError, newFatalErrorRouteLocation } from 'src/utils/errors';
import { sortByDateString } from 'src/utils/date';

import {
  Deployment,
  DeploymentError,
  isDeploymentError,
  isPreDeployment,
  PreDeployment,
} from 'src/api/types/deployments';

export const useDeploymentStore = defineStore('deployment', () => {
  // key is deployment saveName
  type DeploymentMap = Record<string, Deployment | PreDeployment | DeploymentError>;

  const deploymentMap = ref<DeploymentMap>({});

  const api = useApi();

  const refreshDeployments = async() => {
    try {
      const newDeploymentMap: DeploymentMap = {};

      // API Returns:
      // 200 - success
      // 500 - internal server error
      const response = (await api.deployments.getAll()).data;
      response.forEach((deployment) => {
        if (isDeploymentError(deployment)) {
          newDeploymentMap[deployment.deploymentName] = deployment;
        } else {
          newDeploymentMap[deployment.saveName] = deployment;
        }
      });
      deploymentMap.value = newDeploymentMap;
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
      if (isDeploymentError(deployment)) {
        deploymentMap.value[deployment.deploymentName] = deployment;
      } else {
        deploymentMap.value[deployment.saveName] = deployment;
      }
    } catch (error: unknown) {
      if (getStatusFromError(error) === 404) {
        // deployment no longer exists, remove from the map.
        delete deploymentMap.value[deploymentName];
        return;
      }
      // For this page, we send all errors to the fatal error page, including 404
      router.push(newFatalErrorRouteLocation(error, `deployments::getDeployment(${name})`));
    }
  };

  const sortedDeployments = computed(() => {
    const result: Array<Deployment | PreDeployment | DeploymentError> = [];
    const deploymentErrors: Array<DeploymentError> = [];
    const preDeployments: Array<PreDeployment> = [];
    const deployments: Array<Deployment> = [];
    Object.keys(deploymentMap.value).forEach(
      deploymentName => {
        const deployment = deploymentMap.value[deploymentName];
        if (isDeploymentError(deployment)) {
          deploymentErrors.push(deployment);
        } else if (isPreDeployment(deployment)) {
          preDeployments.push(deployment);
        } else {
          deployments.push(deployment);
        }
      }
    );
    deploymentErrors.sort((a, b) => {
      return a.deploymentName.localeCompare(b.deploymentName, undefined, { sensitivity: 'base' });
    });
    preDeployments.sort((a, b) => {
      return a.deploymentName.localeCompare(b.deploymentName, undefined, { sensitivity: 'base' });
    });
    deployments.sort((a, b) => {
      return sortByDateString(a.deployedAt, b.deployedAt);
    });

    return result.concat(deploymentErrors, preDeployments, deployments);
  });

  const init = () => {
    refreshDeployments();
  };
  init();

  return {
    refreshDeployments,
    refreshDeployment,
    sortedDeployments,
    hasDeployments,
    deploymentMap,
  };
});
