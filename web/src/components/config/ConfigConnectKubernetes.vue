<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <ConfigSection
    v-if="kubernetes"
    title="Connect Kubernetes"
  >
    <ConfigSetting
      v-if="kubernetes.imageName !== undefined"
      label="Image Name"
    >
      {{ kubernetes.imageName }}
    </ConfigSetting>

    <ConfigSetting
      v-if="kubernetes.serviceAccountName !== undefined"
      label="Service Account Name"
    >
      {{ kubernetes.serviceAccountName }}
    </ConfigSetting>

    <ConfigSetting
      v-if="kubernetes.cpuLimit !== undefined"
      label="CPU Limit"
    >
      {{ kubernetes.cpuLimit }}
    </ConfigSetting>

    <ConfigSetting
      v-if="kubernetes.cpuRequest !== undefined"
      label="CPU Request"
    >
      {{ kubernetes.cpuRequest }}
    </ConfigSetting>

    <ConfigSetting
      v-if="kubernetes.memoryLimit !== undefined"
      label="Memory Limit"
    >
      {{ kubernetes.memoryLimit }}
    </ConfigSetting>

    <ConfigSetting
      v-if="kubernetes.memoryRequest !== undefined"
      label="Memory Request"
    >
      {{ kubernetes.memoryRequest }}
    </ConfigSetting>

    <ConfigSetting
      v-if="kubernetes.nvidiaGpuLimit !== undefined"
      label="Nvidia GPU Limit"
    >
      {{ kubernetes.nvidiaGpuLimit }}
    </ConfigSetting>

    <ConfigSetting
      v-if="kubernetes.amdGpuLimit !== undefined"
      label="AMD GPU Limit"
    >
      {{ kubernetes.amdGpuLimit }}
    </ConfigSetting>
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
});
</script>
