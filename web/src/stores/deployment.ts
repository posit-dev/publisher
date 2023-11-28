// Copyright (C) 2023 by Posit Software, PBC.

import { CanceledError } from 'axios';
import { defineStore } from 'pinia';
import { Ref, computed, ref } from 'vue';

import api, { Deployment } from 'src/api';
import { deploymentToPaths, pathToManifestFiles } from 'src/api/utils';
import { requestOnce } from 'src/utils/requestOnce';

/**
 * Set the files on the server side.
 * Debounced to avoid API calls on every state change.
 * In progress API calls are cancelled to avoid de-syncing the deployment state.
 */
const setFilesOnServer = requestOnce(async(
  signal: AbortSignal,
  files: string[],
  deploymentState: Ref<Deployment | undefined>
) => {
  try {
    const { data } = await api.deployment.setFiles(
      files,
      { signal: signal }
    );
    deploymentState.value = data;
  } catch (err) {
    if (err instanceof CanceledError) {
      // ignore
    }
  }
}, 500);

/**
 * Set the account on the server side.
 * Debounced to avoid API calls on every state change.
 * In progress API calls are cancelled to avoid de-syncing the deployment state.
 */
const setAccountOnServer = requestOnce(async(
  signal: AbortSignal,
  accountName: string,
  deploymentState: Ref<Deployment | undefined>
) => {
  try {
    const { data } = await api.deployment.setAccount(
      accountName,
      { signal: signal }
    );
    deploymentState.value = data;
  } catch (err) {
    if (err instanceof CanceledError) {
      // ignore
    }
  }
}, 500);

/**
 * Set the title on the server side.
 * Debounced to avoid API calls on every state change.
 * In progress API calls are cancelled to avoid de-syncing the deployment state.
 */
const setTitleOnServer = requestOnce(async(
  signal: AbortSignal,
  title: string,
  deploymentState: Ref<Deployment | undefined>
) => {
  try {
    const { data } = await api.deployment.setTitle(
      title,
      { signal: signal }
    );
    deploymentState.value = data;
  } catch (err) {
    if (err instanceof CanceledError) {
      // ignore
    }
  }
}, 500);

export const useDeploymentStore = defineStore('deployment', () => {
  const deployment = ref<Deployment>();

  const files = computed<string[]>({
    get: () => deploymentToPaths(deployment.value),
    set: async(selectedFiles) => {
      // Update the deployment state immediately before sending to server
      if (deployment.value) {
        deployment.value.manifest.files = pathToManifestFiles(selectedFiles);
      }

      setFilesOnServer(selectedFiles, deployment);
    }
  });

  const account = computed<string>({
    get: () => deployment.value?.target.accountName || '',
    set: (newName: string) => {
      // Update the deployment state immediately before sending to server
      if (deployment.value) {
        deployment.value.target.accountName = newName;
      }

      setAccountOnServer(newName, deployment);
    }
  });

  const title = computed<string>({
    get: () => {
      return deployment.value?.connect.content.title || '';
    },
    set: (newTitle) => {
      // Update the deployment state immediately before sending to server
      if (deployment.value) {
        deployment.value.connect.content.title = newTitle;
      }

      setTitleOnServer(newTitle, deployment);
    }
  });

  return {
    deployment,
    files,
    account,
    title
  };
});
