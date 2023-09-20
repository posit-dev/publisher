<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-expansion-item
    :default-opened="defaultOpen"
    :expand-icon="expandIcon"
    header-class="q-px-none"
    :group="group"
  >
    <template #header>
      <q-item-section
        avatar
        class="q-ml-sm"
      >
        <slot name="avatar" />
      </q-item-section>

      <q-item-section>
        <q-item-label>{{ title }}</q-item-label>
        <q-item-label
          v-if="subtitle"
          caption
        >
          {{ subtitle }}
        </q-item-label>
        <q-tooltip
          v-if="tooltip"
          anchor="top middle"
        >
          {{ tooltip }}
        </q-tooltip>
      </q-item-section>
    </template>

    <q-card dark>
      <q-card-section>
        <slot />
        <!-- TODO: select from previous deployments or add to existing or new targets -->
      </q-card-section>
    </q-card>
  </q-expansion-item>
</template>

<script setup lang="ts">

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, required: false, default: undefined },
  tooltip: { type: String, required: false, default: undefined },
  defaultOpen: { type: Boolean, required: false, default: false },
  expandIcon: { type: String, required: false, default: undefined },
  group: { type: String, required: false, default: undefined },
});
</script>
