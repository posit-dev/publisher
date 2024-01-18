<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="config-setting">
    <dt class="config-label text-weight-medium space-between-x-sm">
      <span>{{ label }}</span>
      <span
        v-if="previousValue !== value"
        class="text-low-contrast text-weight-regular"
      >
        Changed since last deploy
      </span>
    </dt>
    <dd class="config-value">
      <div
        v-if="value !== undefined"
        class="space-between-x-md"
      >
        <template
          v-if="previousValue !== value"
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
import DiffTag from 'src/components/DiffTag.vue';

defineProps({
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
      align-items: center;
      min-width: 18rem;
      padding-right: 24px;
    }

    .config-value {
      margin-top: 0px;
    }
  }
}
</style>
