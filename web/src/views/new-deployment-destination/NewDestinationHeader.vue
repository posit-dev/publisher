<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="row vertical-top q-gutter-x-md">
    <div class="col text-center col-6">
      <div>Destination Summary</div>
      <div>New Deployment to {{ destinationURL }}</div>
    </div>
    <div class="col-3">
      <DenseAccountList
        v-model="accountNameModel"
        :url="destinationURL"
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

import { computed, onMounted, ref, watch } from 'vue';
import { Account, useApi } from 'src/api';

import DenseAccountList from 'src/components/DenseAccountList.vue';

const api = useApi();

const destinationURL = ref<string>('');

const emit = defineEmits(['update:modelValue']);
const props = defineProps({
  // account name
  modelValue: { type: String, required: true },
});

const accountNameModel = computed({
  get() {
    return props.modelValue;
  },
  set(newValue) {
    emit('update:modelValue', newValue);
  }
});

const init = async() => {
  try {
    const response = await api.accounts.getAll();

    const credentials = response.data.accounts.find(
      (account: Account) => account.name === props.modelValue
    );
    if (credentials) {
      destinationURL.value = credentials.url;
    }
  } catch (err) {
    // TODO: handle the API error
  }
};

onMounted(() => {
  init();
});

watch(
  () => props.modelValue,
  () => {
    init();
  }
);
</script>
