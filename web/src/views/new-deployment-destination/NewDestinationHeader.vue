<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="destination-header">
    <div class="publisher-layout q-py-md">
      <q-breadcrumbs>
        <q-breadcrumbs-el
          label="Project"
          :to="{ name: 'project' }"
        />
        <q-breadcrumbs-el label="New Destination" />
      </q-breadcrumbs>

      <div class="col-4 vertical-top q-gutter-x-md">
        <div class="col text-center col-4">
          <div>Destination Summary</div>
          <p> {{ destinationMessage }}.</p>
          <p> {{ addingDestinationMessage }}</p>
        </div>
        <div class="col q-mt-md">
          <div class="row justify-around">
            <div class="col-7">
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
          </div>
          <div class="row justify-left q-ma-sm q-mr-md">
            <div class="col-11">
              <PublishProgressSummary
                :id="publishingLocalId"
              />
              <RouterLink :to="{ name: 'progress' }">
                Log View
              </RouterLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import { computed, ref, watch } from 'vue';
import { Account, useApi } from 'src/api';

import SelectAccount from 'src/components/SelectAccount.vue';
import PublishProgressSummary from 'src/components/PublishProgressSummary.vue';
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
  destinationName: { type: String, default: undefined, required: false },
});

const initiatePublishProcess = async() => {
  emit('publish');

  const result = await eventStore.initiatePublishProcessWithEvents(
    props.accountName,
    props.contentId,
    props.destinationName,
  );
  if (result instanceof Error) {
    return result;
  }
  publishingLocalId.value = result;
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

const destinationMessage = computed(() => {
  if (props.contentId) {
    return `Updating existing content (${props.contentId}) on ${destinationURL.value}.`;
  }
  return `New deployment of content to ${destinationURL.value}`;
});

const addingDestinationMessage = computed(() => {
  if (props.destinationName) {
    return `Publishing will add a destination named "${props.destinationName}" to your project.`;
  }
  return 'Publishing will add this Destination to your project.';
});

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

<style scoped lang="scss">
.destination-header {
  border-bottom: 1px solid;
}

.body--light {
  .destination-header {
    background-color: white;
    border-color: $grey-4;
  }
}

.body--dark {
  .destination-header {
    border-color: $grey-8;
  }
}
</style>
