// Copyright (C) 2023 by Posit Software, PBC.

import { CanceledError } from 'axios';
import { defineStore } from 'pinia';
import { Ref, computed, ref } from 'vue';

import api, { Deployment } from 'src/api';
import { CancelController } from 'src/api/utils/CancelController';
import { deploymentToPathnames, pathnamesToManifestFiles } from 'src/api/utils';
import { debounce } from 'quasar';

const fileSyncCancelController = new CancelController();

/**
 * Set the files on the server side.
 * Debounced to avoid API calls on every state change.
 * In progress API calls are cancelled to avoid de-syncing the deployment state.
 */
const setFilesOnServer = debounce((
  files: string[],
  deploymentState: Ref<Deployment | undefined>
) => fileSyncCancelController.cancelPrevious(async() => {
  try {
    const { data } = await api.deployment.setFiles(
      files,
      { signal: fileSyncCancelController.signal }
    );
    deploymentState.value = data;
  } catch (err) {
    if (err instanceof CanceledError) {
      // ignore
    }
  }
}), 0);

export const useDeploymentStore = defineStore('deployment', () => {
  const deployment = ref<Deployment>();

  const files = computed<string[]>({
    get: () => deploymentToPathnames(deployment.value),
    set: async(selectedFiles) => {
      // Update the deployment state immediately before sending to server
      if (deployment.value) {
        deployment.value.manifest.files = pathnamesToManifestFiles(selectedFiles);
      }

      setFilesOnServer(selectedFiles, deployment);
    }
  });

  return {
    deployment,
    files
  };
});
