<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="destination-header">
    <div class="publisher-layout q-py-md">
      <q-breadcrumbs>
        <q-breadcrumbs-el
          label="Project"
          :to="{
            name:
              'project'
          }"
        />
        <q-breadcrumbs-el
          :label="deployment.saveName"
        />
      </q-breadcrumbs>

      <div
        class="flex justify-between q-mt-md row-gap-lg column-gap-xl"
      >
        <div class="space-between-sm">
          <h1 class="text-h6">
            {{ deployment.saveName }}
          </h1>
          <p>
            Redeployment to: <a :href="deployment.serverUrl">{{ deployment.serverUrl }}</a>
          </p>
          <p>
            {{ deployment.id }}
          </p>
          <p>
            Last Published on {{ formatDateString(deployment.deployedAt) }}
          </p>
        </div>

        <div
          class="flex no-wrap items-start"
        >
          <SelectAccount
            class="account-width"
            :accounts="filteredAccountList"
            :url="destinationURL"
            @change="onChange"
          />
          <q-btn
            class="q-ml-md"
            no-caps
            color="white"
            text-color="black"
            label="Publish"
            :disable="eventStore.publishInProgess"
            @click="initiatePublishProcess"
          />
        </div>
      </div>

      <div class="col-4 vertical-top q-gutter-x-md">
        <div class="col q-mt-md">
          <div class="row justify-left q-ma-sm q-mr-md">
            <div class="col-11">
              <PublishProgressSummary
                :id="contentId"
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

import { ref, watch, PropType } from 'vue';

import { Account, Deployment, useApi } from 'src/api';
import SelectAccount from 'src/components/SelectAccount.vue';
import PublishProgressSummary from 'src/components/PublishProgressSummary.vue';
import { useEventStore } from 'src/stores/events';
import { formatDateString } from 'src/utils/date';

const api = useApi();
const eventStore = useEventStore();

const accounts = ref<Account[]>([]);
const filteredAccountList = ref<Account[]>([]);
const destinationURL = ref('');
const selectedAccount = ref<Account>();
const publishingLocalId = ref('');

const emit = defineEmits(['publish']);

const props = defineProps({
  deployment: { type: Object as PropType<Deployment>, required: true },
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
    props.deployment.saveName,
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

<style scoped lang="scss">
.destination-header {
  border-bottom: 1px solid;

  .account-width {
    min-width: 300px;
  }
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
