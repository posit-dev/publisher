<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <span
    class="diff text-weight-medium"
    :class="diffType === 'inserted' ? 'diff-inserted' : 'diff-removed'"
  >
    <span class="diff-marker">{{ marker }}</span>{{ value }}
  </span>
</template>

<script setup lang="ts">
import { PropType, computed } from 'vue';

export type DiffType = 'inserted' | 'removed';

const props = defineProps({
  diffType: {
    type: Object as PropType<DiffType>,
    required: true,
  },
  value: {
    type: [String, Boolean, Number],
    required: true
  }
});

const marker = computed(() => {
  return props.diffType === 'inserted' ? '+' : '-';
});
</script>

<style scoped lang="scss">
.diff {
  display: inline-flex;
  align-items: center;
  border-radius: 8px;
  position: relative;
  border: 1px solid;
  padding-left: 8px;
  padding-right: 8px;
  column-gap: 6px;
  line-height: 1.75;

  &.diff-removed {
    border-color: red;

    .diff-marker {
      border-color: red;
    }
  }

  &.diff-inserted {
    border-color: green;

    .diff-marker {
      border-color: green;
    }
  }

  .diff-marker {
    border-right: 1px solid;
    padding-right: 6px;
  }
}
</style>
