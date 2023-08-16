<template>
  <q-expansion-item>
    <template #header>
      <q-item-section avatar>
        <q-icon
          :name="icon"
          size="35px"
        />
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

    <q-card class="bg-grey-9">
      <q-card-section>
        <slot />
        <!-- TODO: select from previous deployments or add to existing or new targets -->
      </q-card-section>
    </q-card>
  </q-expansion-item>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
  icon: string
  tooltip?: string
}>();
</script>
