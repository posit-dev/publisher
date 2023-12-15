<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div>
    <h3 class="config-section-title q-mt-md">
      {{ title }}
    </h3>
    <p
      v-if="subtitle"
      class="q-mt-xs"
    >
      {{ subtitle }}
    </p>
    <dl class="q-mt-sm q-pt-sm space-between-sm">
      <slot />
    </dl>
  </div>
</template>

<script setup lang="ts">
defineProps({
  title: {
    type: String,
    required: true,
  },
  subtitle: {
    type: String,
    required: false,
    default: undefined,
  },
});
</script>

<style scoped lang="scss">
.config-section-title {
    font-size: 1rem;
    font-weight: 500;
    line-height: 1.5;
}

dl {
    border: 1px solid;
    border-radius: 8px;
    padding: 16px;
}

.body--light {
    dl {
        border-color: $grey-4;
    }
}
.body--dark {
    dl {
        border-color: $grey-8;
    }
}
</style>
