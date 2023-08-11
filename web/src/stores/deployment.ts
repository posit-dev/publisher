// Copyright (C) 2023 by Posit Software, PBC.

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import api, { Deployment } from 'src/api';

export const useDeploymentStore = defineStore('deployment', () => {
  const deployment = ref<Deployment>();

  const files = computed<string[]>({
    get: () => Object.keys(deployment.value?.manifest.files ?? {}),
    set: async(selectedFiles) => {
      const { data } = await api.deployment.setFiles(selectedFiles);
      deployment.value = data;
    }
  });

  return {
    deployment,
    files
  };
});
