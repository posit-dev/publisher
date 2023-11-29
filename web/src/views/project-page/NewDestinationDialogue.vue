<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="val => emits('update:modelValue', val)"
  >
    HERE IT IS
  </q-dialog>
</template>

<script setup lang="ts">
defineProps({
  modelValue: { type: Boolean, required: true }
});
const emits = defineEmits(['update:modelValue']);

</script>
