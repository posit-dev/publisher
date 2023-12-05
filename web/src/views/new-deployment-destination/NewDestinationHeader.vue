<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="row vertical-top q-gutter-x-md">
    <div class="col text-center col-6">
      <div>Destination Summary</div>
      <div>New Deployment to {{ destinationURL }}</div>
      <p>Publishing will add this Destination to your project.</p>
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
        :disable="eventStore.publishInProgess"
        @click="initiatePublishProcess"
      />
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
const fixedAccountList = ref<Account[]>([]);
const destinationURL = ref('');
const publishingLocalId = ref('');

const emit = defineEmits(['publish']);

const props = defineProps({
  accountName: { type: String, required: true },
  contentId: { type: String, default: undefined, required: false },
});

const initiatePublishProcess = async() => {
  emit('publish');

  const result = await eventStore.initiatePublishProcessWithEvents(
    props.accountName,
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
    if (!stat.completed) {
      return 'in-progress';
    } else if (!stat.error) {
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
