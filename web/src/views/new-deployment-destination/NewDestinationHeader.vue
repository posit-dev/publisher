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
          <template v-if="publishAsNew">
            <p>
              New deployment to: {{ destinationURL }}
            </p>
            <p>
              {{ addingDestinationMessage }}
            </p>
          </template>
          <template v-else>
            <p>
              Redeployment to: {{ destinationURL }}
            </p>
            <p>
              {{ contentId }}
            </p>
          </template>
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
      <div
        v-if="showPublishStatus"
        class="col-4 vertical-top q-gutter-x-md"
      >
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
import {
  newFatalErrorRouteLocation,
} from 'src/util/errors';
import { useRouter } from 'vue-router';
import PButton from 'src/components/PButton.vue';

const api = useApi();
const eventStore = useEventStore();
const router = useRouter();

const accounts = ref<Account[]>([]);
const fixedAccountList = ref<Account[]>([]);
const destinationURL = ref('');
const publishingLocalId = ref('');
const contentId = ref('');
const numSuccessfulPublishes = ref(0);

const emit = defineEmits(['publish']);

const props = defineProps({
  accountName: { type: String, required: true },
  destinationName: { type: String, default: undefined, required: false },
});

const initiatePublishProcess = async() => {
  emit('publish');
  // Returns:
  // 200 - success
  // 400 - bad request
  // 500 - internal server error
  // ERROR - publishing checks
  // Errors returned through event stream
  try {
    const result = await eventStore.initiatePublishProcessWithEvents(
      publishAsNew.value,
      props.accountName,
      props.destinationName,
      contentId.value,
    );
    publishingLocalId.value = result;
  } catch (error: unknown) {
    // Send all errors to the fatal error page. There is nothing the user can do here
    // easily. This includes 400 errors.
    router.push(
      newFatalErrorRouteLocation(
        error,
        'NewDestinationHeader::initiatePublishProcess()'
      ),
    );
  }
};

const updateAccountList = async() => {
  try {
    // API Returns:
    // 200 - success
    // 404 - account not found
    // 500 - internal server error
    const response = await api.accounts.get(props.accountName);
    if (response.data) {
      destinationURL.value = response.data.url;
      fixedAccountList.value = [response.data];
    }
  } catch (error: unknown) {
    // send all errors, including 404, to the fatal error page.
    router.push(
      newFatalErrorRouteLocation(
        error,
        'NewDestinationHeader::updateAccountList()',
      ),
    );
  }
};

const addingDestinationMessage = computed(() => {
  if (props.destinationName) {
    return `Publishing will add a destination named "${props.destinationName}" to your project.`;
  }
  return 'Publishing will add this Destination to your project.';
});

const showPublishStatus = computed(() => {
  // Show only if we've previously published or if this is the first one,
  // then only if it applies to us.
  return (
    numSuccessfulPublishes.value ||
    eventStore.doesPublishStatusApply(publishingLocalId.value)
  );
});

// Watch the events in order to know when we have
// published enough to go from new deployment to an update
watch(
  () => eventStore.publishInProgess,
  (newVal: boolean, oldVal: boolean) => {
    if (
      // we have progressed from publishing to not publishing
      !newVal &&
      oldVal &&
      // and last publishing run was ours
      (
        eventStore.doesPublishStatusApply(publishingLocalId.value) ||
        eventStore.doesPublishStatusApply(contentId.value)
      ) &&
      // and it was successful enough to get a content id assigned
      eventStore.currentPublishStatus.contentId
    ) {
      // increment our counter
      numSuccessfulPublishes.value += 1;
    }
  }
);

const publishAsNew = computed(() => {
  return numSuccessfulPublishes.value === 0;
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
