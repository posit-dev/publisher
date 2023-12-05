<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div>
    <div class="row vertical-top q-gutter-x-md">
      <div class="col text-center col-6">
        <div>Destination Summary</div>
        <div>
          Redeployment to {{ url }}
        </div>
        <div>
          Content ID: {{ contentId }}
        </div>
      </div>
      <div class="col-3">
        <SelectAccount
          :accounts="filteredAccountList"
          :url="destinationURL"
          @change="onChange"
        />
      </div>
      <div class="col-2">
        <q-btn
          no-caps
          color="white"
          text-color="black"
          label="Publish"
          :disable="eventStore.publishInProgess"
          @click="initiatePublishProcess"
        />
      </div>
    </div>
    <div class="q-mt-lg">
      TEMP: Selected Account Name = {{ selectedAccount?.name }}
    </div>
    <div class="q-mt-lg">
      TEMP: Publishing Status = {{ publishingStatusString }}
    </div>
  </div>
</template>

<script setup lang="ts">

import { computed, ref, watch } from 'vue';
import { Account, useApi } from 'src/api';

import SelectAccount from 'src/components/SelectAccount.vue';
import { useEventStore } from 'src/stores/events';

const api = useApi();
const eventStore = useEventStore();

const accounts = ref<Account[]>([]);
const filteredAccountList = ref<Account[]>([]);
const destinationURL = ref('');
const selectedAccount = ref<Account>();
const publishingLocalId = ref('');

const emit = defineEmits(['publish']);

const props = defineProps({
  contentId: { type: String, required: true },
  url: { type: String, required: true },
});

const onChange = (account: Account) => {
  selectedAccount.value = account;
};

const initiatePublishProcess = async() => {
  const accountName = selectedAccount.value?.name;
  if (!accountName) {
    // internal error
    console.log('An internal error has occurred when calling publish.start - no accountName');
    return;
  }
  emit('publish');

  const result = await eventStore.initiatePublishProcessWithEvents(
    accountName,
    props.contentId,
  );
  if (result instanceof Error) {
    return result;
  }
  publishingLocalId.value = result;
};

const publishingStatus = computed(() => {
  if (!publishingLocalId.value) {
    return undefined;
  }
  return eventStore.publishStatusMap.get(publishingLocalId.value);
});

const publishingStatusString = computed(() => {
  if (publishingStatus.value) {
    const stat = publishingStatus.value;
    if (stat.completion === 'started') {
      return 'in-progress';
    } else if (stat.completion === 'success') {
      return 'completed - successfully';
    }
    return `completed - error: ${stat.error}`;
  }
  return 'unknown';
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
    props.url,
    accounts.value,
  ],
  () => {
    const credentials = accounts.value.filter(
      (account: Account) => account.url === props.url
    );
    filteredAccountList.value = credentials;
  },
  { immediate: true }
);
</script>
