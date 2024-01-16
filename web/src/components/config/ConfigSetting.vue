<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="config-setting">
    <dt class="config-label text-weight-medium">
      {{ label }}
    </dt>
    <dd class="config-value">
      <div
        v-if="Boolean(value)"
        class="space-between-x-xs"
      >
        <span
          v-if="Boolean(previousValue)"
          class="text-strike"
        >
          {{ previousValue }}
        </span>
        <span>{{ value }}</span>
      </div>
      <slot />
    </dd>
  </div>
</template>

<script setup lang="ts">
defineProps({
  label: {
    type: String,
    required: true,
  },
  value: {
    type: String,
    required: false,
    default: undefined,
  },
  previousValue: {
    type: String,
    required: false,
    default: undefined,
  },
});
</script>

<style scoped lang="scss">

@media (max-width: 600px) {
  .config-setting {
    .config-value {
      margin-top: 4px;
    }
  }
}

@media (min-width: 601px) {
  .config-setting {
    display: flex;

    .config-label {
      min-width: 15rem;
      padding-right: 24px;
    }

    .config-value {
      margin-top: 0px;
    }
  }
}
</style>
