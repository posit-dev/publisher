<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <ConfigSection
    v-if="kubernetes"
    title="Connect Kubernetes"
  >
    <ConfigSetting
      v-if="kubernetes.imageName !== undefined"
      label="Image Name"
      :value="kubernetes.imageName"
      :previous-value="previousKubernetes?.imageName"
    />

    <ConfigSetting
      v-if="kubernetes.serviceAccountName !== undefined"
      label="Service Account Name"
      :value="kubernetes.serviceAccountName"
      :previous-value="previousKubernetes?.serviceAccountName"
    />

    <ConfigSetting
      v-if="kubernetes.cpuLimit !== undefined"
      label="CPU Limit"
      :value="kubernetes.cpuLimit"
      :previous-value="previousKubernetes?.cpuLimit"
    />

    <ConfigSetting
      v-if="kubernetes.cpuRequest !== undefined"
      label="CPU Request"
      :value="kubernetes.cpuRequest"
      :previous-value="previousKubernetes?.cpuRequest"
    />

    <ConfigSetting
      v-if="kubernetes.memoryLimit !== undefined"
      label="Memory Limit"
      :value="kubernetes.memoryLimit"
      :previous-value="previousKubernetes?.memoryLimit"
    />

    <ConfigSetting
      v-if="kubernetes.memoryRequest !== undefined"
      label="Memory Request"
      :value="kubernetes.memoryRequest"
      :previous-value="previousKubernetes?.memoryRequest"
    />

    <ConfigSetting
      v-if="kubernetes.nvidiaGpuLimit !== undefined"
      label="Nvidia GPU Limit"
      :value="kubernetes.nvidiaGpuLimit"
      :previous-value="previousKubernetes?.nvidiaGpuLimit"
    />

    <ConfigSetting
      v-if="kubernetes.amdGpuLimit !== undefined"
      label="AMD GPU Limit"
      :value="kubernetes.amdGpuLimit"
      :previous-value="previousKubernetes?.amdGpuLimit"
    />
  </ConfigSection>
</template>

<script setup lang="ts">
import { PropType } from 'vue';

import { ConnectKubernetes } from 'src/api';
import ConfigSection from 'src/components/config/ConfigSection.vue';
import ConfigSetting from 'src/components/config/ConfigSetting.vue';

defineProps({
  kubernetes: {
    type: Object as PropType<ConnectKubernetes>,
    default: undefined,
    required: false,
  },
  previousKubernetes: {
    type: Object as PropType<ConnectKubernetes>,
    default: undefined,
    required: false,
  }
});
</script>
