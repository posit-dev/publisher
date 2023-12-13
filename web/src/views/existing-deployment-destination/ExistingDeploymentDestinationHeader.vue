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
          :label="url"
        />
      </q-breadcrumbs>

      <div class="col-4 vertical-top q-gutter-x-md">
        <div class="col text-center col-4">
          <div>Destination Summary</div>
          <div>
            Redeployment to {{ url }}
          </div>
          <div>
            Content ID: {{ contentId }}
          </div>
        </div>
        <div class="col q-mt-md">
          <div class="row justify-around">
            <div class="col-7">
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

import { ref, watch } from 'vue';
import { Account, Deployment, useApi } from 'src/api';

import SelectAccount from 'src/components/SelectAccount.vue';
import PublishProgressSummary from 'src/components/PublishProgressSummary.vue';
import { useEventStore } from 'src/stores/events';
import { PropType } from 'vue';

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
  deployment: { type: Object as PropType<Deployment>, required: true }
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
