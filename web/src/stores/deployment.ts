// Copyright (C) 2023 by Posit Software, PBC.

import { CanceledError } from 'axios';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import api, { Deployment, ManifestFile } from 'src/api';
import { CancelController } from 'src/api/utils/CancelController';

const fileSyncCancelController = new CancelController();

export const useDeploymentStore = defineStore('deployment', () => {
  const deployment = ref<Deployment>();

  const files = computed<string[]>({
    get: () => Object.keys(deployment.value?.manifest.files ?? {}),
    set: async(selectedFiles) => {
      const changed = selectedFiles.reduce((acc, file) => {
        acc[file] = { checksum: '' };
        return acc;
      }, {} as Record<string, ManifestFile>);
      if (deployment.value) {
        deployment.value.manifest.files = changed;
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
