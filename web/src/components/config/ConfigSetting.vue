<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="config-setting">
    <dt class="config-label text-weight-medium space-between-x-sm">
      <span>{{ label }}</span>
      <span
        v-if="showDiff"
        class="text-low-contrast text-weight-regular"
      >
        Changed since last deploy
      </span>
    </dt>
    <dd class="config-value">
      <div
        v-if="value !== undefined"
        class="flex gap-sm"
      >
        <template
          v-if="showDiff"
        >
          <DiffTag
            v-if="previousValue !== undefined"
            diff-type="removed"
            :value="previousValue"
          />
          <DiffTag
            diff-type="inserted"
            :value="value"
          />
        </template>
        <span v-else>{{ value }}</span>
      </div>
      <slot />
    </dd>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';

import { isPreDeployment } from 'src/api';
import DiffTag from 'src/components/DiffTag.vue';
import { deploymentKey } from 'src/utils/provide';

const props = defineProps({
  label: {
    type: String,
    required: true,
  },
  value: {
    type: [String, Boolean, Number],
    required: false,
    default: undefined,
  },
  previousValue: {
    type: [String, Boolean, Number],
    required: false,
    default: undefined,
  },
});

const deployment = inject(deploymentKey);

const showDiff = computed((): boolean => {
  const isPre = deployment ? isPreDeployment(deployment) : false;
  return !isPre && props.previousValue !== props.value;
});
</script>

<style scoped lang="scss">
@media (max-width: 700px) {
  .config-setting {
    .config-value {
      margin-top: 4px;
    }
  }
}

@media (min-width: 701px) {
  .config-setting {
    display: flex;

    .config-label {
      display: flex;
      min-width: 18rem;
      padding-right: 24px;
    }

    .config-value {
      margin-top: 0px;
    }
  }
}
</style>
