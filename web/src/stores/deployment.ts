// Copyright (C) 2023 by Posit Software, PBC.

import { CanceledError } from 'axios';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import api, { Deployment } from 'src/api';
import { CancelController } from 'src/api/utils/CancelController';
import { deploymentToPathnames, pathnamesToManifestFiles } from 'src/api/utils';

const fileSyncCancelController = new CancelController();

export const useDeploymentStore = defineStore('deployment', () => {
  const deployment = ref<Deployment>();

  const files = computed<string[]>({
    get: () => deploymentToPathnames(deployment.value),
    set: async(selectedFiles) => {
      if (deployment.value) {
        deployment.value.manifest.files = pathnamesToManifestFiles(selectedFiles);
      }

      fileSyncCancelController.cancelPrevious(async() => {
        try {
          const { data } = await api.deployment.setFiles(
            selectedFiles,
            { signal: fileSyncCancelController.signal }
          );
          deployment.value = data;
        } catch (err) {
          if (err instanceof CanceledError) {
            // ignore
          }
        }
      });
    }
  });

  return {
    deployment,
    files
  };
});
