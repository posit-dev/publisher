// Copyright (C) 2023 by Posit Software, PBC.

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import api, { Deployment, ManifestFile } from 'src/api';
import { CanceledError } from 'axios';

let fileSyncController: AbortController | undefined;

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

      if (fileSyncController) {
        fileSyncController.abort();
      }
      fileSyncController = new AbortController();
      try {
        const { data } = await api.deployment.setFiles(
          selectedFiles,
          { signal: fileSyncController.signal }
        );
        deployment.value = data;
      } catch (err) {
        if (err instanceof CanceledError) {
          // ignore
        }
      }
    }
  });

  return {
    deployment,
    files
  };
});
