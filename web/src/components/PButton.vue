<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <QBtn
    v-bind="{ ...$attrs, ...qBtnPassthroughProps, ...colors }"
    no-caps
    unelevated
    :outline="props.hierarchy === 'secondary'"
  >
    <template
      v-for="(_, slot) of $slots"
      #[slot]="scope"
    >
      <slot
        v-if="slot"
        :name="slot"
        v-bind="scope"
      />
    </template>
  </QBtn>
</template>

<script setup lang="ts">
import { QBtn, QBtnProps, useQuasar } from 'quasar';
import { computed } from 'vue';

type Hierarchy = 'primary' | 'secondary';
type QBtnPassthroughProps = Omit<QBtnProps, 'color' | 'textColor' | 'noCaps' | 'unelevated'>;

const $q = useQuasar();
const props = defineProps<{
  hierarchy: Hierarchy;
} & QBtnPassthroughProps
>();

const colors = computed(() => {
  if (props.hierarchy === 'primary') {
    return {
      color: $q.dark.isActive ? 'grey-1' : 'grey-10',
      'text-color': $q.dark.isActive ? 'black' : 'white'
    };
  }
  return undefined;
});

const qBtnPassthroughProps = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { hierarchy, ...rest } = props;
  return rest;
});
</script>

