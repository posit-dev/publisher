<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="row vertical-top q-gutter-x-md">
    <div class="col text-center col-6">
      <div>Destination Summary</div>
      <div>New Deployment to {{ destinationURL }}</div>
      <div v-if="contentId">
        Content ID: {{ contentId }}
      </div>
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
        :disable="disablePublishing"
        @click="onPublish"
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
const disablePublishing = ref(false);

const emit = defineEmits(['publish']);

const props = defineProps({
  accountName: { type: String, required: true },
  contentId: { type: String, default: undefined, required: false },
});

const onPublish = async() => {
  emit('publish');
  disablePublishing.value = true;
  try {
    await api.deployments.publish(
      props.accountName,
      props.contentId,
    );
    disablePublishing.value = false;
  } catch (e) {
    // Temporary until we determine the mechanism to notify users of general errors.
    console.log('An error has occurred when calling publish.start:', e);
    disablePublishing.value = false;
  }
};

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
