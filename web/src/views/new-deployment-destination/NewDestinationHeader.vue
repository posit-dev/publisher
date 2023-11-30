<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="row vertical-top q-gutter-x-md">
    <div class="col text-center col-6">
      <div>Destination Summary</div>
      <div>New Deployment to {{ destinationURL }}</div>
    </div>
    <div class="col-3">
      <SelectAccount
        :accounts="fixedAccountList"
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

import { ref, watch } from 'vue';
import { Account, useApi } from 'src/api';

import SelectAccount from 'src/components/SelectAccount.vue';

const api = useApi();

const accounts = ref<Account[]>([]);
const fixedAccountList = ref<Account[]>([]);
const destinationURL = ref('');

const props = defineProps({
  accountName: { type: String, required: true },
});

const updateAccountList = async() => {
  try {
    const response = await api.accounts.getAll();
    accounts.value = response.data.accounts;
  } catch (err) {
    // TODO: handle the API error
  }
};
updateAccountList();

watch(
  () => [
    props.accountName,
    accounts.value,
  ],
  () => {
    const credentials = accounts.value.find(
      (account: Account) => account.name === props.accountName
    );
    if (credentials) {
      destinationURL.value = credentials.url;
      fixedAccountList.value = [credentials];
    }
  },
  { immediate: true }
);

</script>
