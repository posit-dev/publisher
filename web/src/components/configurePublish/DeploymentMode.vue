<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="row justify-center">
    <div style="width: 60%">
      <q-btn-toggle
        v-model="deployMode"
        no-caps
        unelevated
        dark
        size="1rem"
        padding="2px"
        spread
        toggle-color="primary"
        color="dark-grey"
        text-color="white"
        :options="options"
        style="border: 1px solid #027be3;"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { PropType } from 'vue';

import { useModelWrapper } from 'src/utils/modelWrapper.ts';
import type { DeploymentModeType } from 'src/api/types/deployments.ts';

const emit = defineEmits(['update:modelValue']);

const props = defineProps({
  modelValue: {
    type: String as PropType<DeploymentModeType>,
    required: true,
  },
});

const deployMode = useModelWrapper(props, emit);

const options = [
  { label: 'New Deployment', value: 'new' },
  { label: 'Existing Deployment', value: 'update' }
];

</script>
