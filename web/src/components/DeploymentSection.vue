<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <section class="publisher-layout q-pt-lg q-pb-xl space-between-lg">
    <div>
      <h2 class="text-h6">
        {{ title }}
      </h2>
      <p
        v-if="subtitle"
        class="q-mt-xs"
      >
        {{ subtitle }}
      </p>
    </div>
    <slot />
  </section>
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
    default: undefined
  },
});
</script>

<style scoped lang="scss">
section:not(:last-child) {
  border-bottom: 1px solid;
}

.body--light {
  section {
    border-color: $grey-4;
  }
}

.body--dark {
  section {
    border-color: $grey-8;
  }
}
</style>
