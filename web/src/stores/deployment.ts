// Copyright (C) 2023 by Posit Software, PBC.

import { defineStore } from 'pinia';
import { ref } from 'vue';

import { Deployment } from 'src/api';

export const useDeploymentStore = defineStore('deployment', () => {
  const deployment = ref<Deployment>();

  return {
    deployment
  };
});
