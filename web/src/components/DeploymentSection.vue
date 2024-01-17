<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <section class="q-pt-lg q-pb-xl">
    <div class="publisher-layout space-between-y-lg">
      <div>
        <h2 class="text-h6">
          {{ title }}
        </h2>
        <p
          v-for="(subtitle, index) in subtitles"
          :key="index"
          class="q-mt-xs"
        >
          {{ subtitle }}
        </p>
      </div>
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import { PropType } from 'vue';

defineProps({
  title: {
    type: String,
    required: true,
  },
  subtitles: {
    type: Object as PropType<string[]>,
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
