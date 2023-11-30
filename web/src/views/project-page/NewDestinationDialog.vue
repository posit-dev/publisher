<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-dialog
    :model-value="modelValue"
    @hide="hide"
    @update:model-value="val => emits('update:modelValue', val)"
  >
    <q-card class="dialog-width">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">
          Add Destination
        </div>
        <q-space />
        <q-btn
          v-close-popup
          icon="close"
          flat
          round
          dense
        />
      </q-card-section>

      <q-card-section>
        <q-form
          class="q-gutter-md"
          @reset="resetForm"
          @submit.prevent="addDestination"
        >
          <q-input
            v-model="serverUrl"
            label="Server URL"
          />
          <q-input
            v-model="contentId"
            label="Content ID"
            hint="Optional"
          />

          <div>
            <q-btn
              type="reset"
              label="Cancel"
              @click="hide"
            />
            <q-btn
              type="submit"
              color="primary"
              class="q-ml-sm"
              label="Add"
            />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';

defineProps({
  modelValue: { type: Boolean, required: true }
});
const emits = defineEmits(['update:modelValue']);

const serverUrl = ref<string>('');
const contentId = ref<string>('');

function resetForm() {
  serverUrl.value = '';
  contentId.value = '';
}

function addDestination() {
  console.log('Destination added');
}

function hide() {
  resetForm();
  emits('update:modelValue', false);
}

</script>

<style scoped>
.dialog-width {
  width: 500px;
  max-width: 90vw;
}
</style>
