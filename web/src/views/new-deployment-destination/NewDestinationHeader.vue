<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="row vertical-top q-gutter-x-md">
    <div class="col text-center col-6">
      <div>Destination Summary</div>
      <div>New Deployment to {{ url }}</div>
    </div>
    <div class="col-3">
      <DenseAccountList
        v-model="accountModel"
        :url="url"
      />
    </div>
    <div class="col-2">
      <q-btn
        no-caps
        color="white"
        text-color="black"
        label="Publish"
      />
    </div>
  </div>
</template>

<script setup lang="ts">

import { computed } from 'vue';

import DenseAccountList from 'src/components/DenseAccountList.vue';

const emit = defineEmits(['update:modelValue']);
const props = defineProps({
  url: { type: String, required: true },
  // account name
  modelValue: { type: String, required: true },
});

const accountModel = computed({
  get() {
    return props.modelValue;
  },
  set(newValue) {
    emit('update:modelValue', newValue);
  }
});

</script>
