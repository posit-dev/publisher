<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-banner
    v-if="hasErrorMessages"
    dense
    inline-actions
    class="text-white bg-red"
  >
    <div
      v-for="(msg, i) in errorMessages"
      :key="i"
      class="text-caption q-ma-sm"
    >
      <div v-for="(line, j) in msg" :key="j" class="text-caption q-ma-sm">
        {{ line }}
      </div>
    </div>
    <template #action>
      <q-btn flat color="white" label="Dismiss" @click="emit('dismiss')" />
    </template>
  </q-banner>
</template>

<script setup lang="ts">
import { PropType, computed } from "vue";
import { ErrorMessages } from "src/utils/errors";

const emit = defineEmits(["dismiss"]);
const props = defineProps({
  // error messages are
  errorMessages: { type: Object as PropType<ErrorMessages>, required: true },
});

const hasErrorMessages = computed(() => {
  return props.errorMessages.length;
});
</script>
