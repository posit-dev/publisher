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

      <div
        class="flex justify-between q-mt-md row-gap-lg column-gap-xl"
      >
        <div class="space-between-sm">
          <h1
            v-if="destinationName"
            class="text-h6"
          >
            {{ destinationName }}
          </h1>
          <template v-if="contentId">
            <p>
              Redeployment to: <a :href="destinationURL">{{ destinationURL }}</a>
            </p>
            <p>
              {{ contentId }}
            </p>
          </template>
          <p v-else>
            New deployment to: <a :href="destinationURL">{{ destinationURL }}</a>
          </p>
          <p> {{ addingDestinationMessage }}</p>
        </div>

        <div
          class="flex no-wrap items-start"
        >
          <SelectAccount
            class="account-width"
            :accounts="fixedAccountList"
            :url="destinationURL"
          />
          <PButton
            hierarchy="primary"
            class="q-ml-md"
            padding="sm md"
            :disable="eventStore.publishInProgess"
            @click="initiatePublishProcess"
          >
            Publish
          </PButton>
        </div>
      </div>

      <div class="col-4 vertical-top q-gutter-x-md">
        <div class="col q-mt-md">
          <div class="row justify-left">
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
import PButton from 'src/components/PButton.vue';

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
    const response = await api.accounts.get(props.accountName);
    if (response.data) {
      destinationURL.value = response.data.url;
      fixedAccountList.value = [response.data];
    }
  } catch (err) {
    // TODO: handle the API error
  }
};

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
    updateAccountList();
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
