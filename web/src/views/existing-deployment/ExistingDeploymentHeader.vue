<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="deployment-header">
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
            Redeployment to: {{ deployment.serverUrl }}
          </p>
          <p>
            {{ deployment.id }}
          </p>
          <p>
            Last Deployed on {{ formatDateString(deployment.deployedAt) }}
          </p>
        </div>

        <div
          class="flex no-wrap items-start"
        >
          <SelectAccount
            class="account-width"
            :accounts="filteredAccountList"
            :url="deploymentURL"
            @change="onChange"
          />
          <PButton
            hierarchy="primary"
            class="q-ml-md"
            padding="sm md"
            :disable="eventStore.publishInProgess"
            @click="initiateRedeploy"
          >
            Redeploy
          </PButton>
        </div>
      </div>

      <div
        class="col-4 vertical-top q-gutter-x-md"
      >
        <div class="col q-mt-md">
          <div class="row justify-left">
            <div class="col-11">
              <DeployProgressSummary
                :id="deployment.id"
                :current-tense="showDeployStatusAsCurrent"
              />
              <RouterLink
                v-if="showLogsLink"
                :to="routerLocation"
              >
                View summarized redeployment logs
              </RouterLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref, watch, PropType, computed } from 'vue';

import { Account, Deployment, useApi } from 'src/api';
import SelectAccount from 'src/components/SelectAccount.vue';
import PButton from 'src/components/PButton.vue';
import DeployProgressSummary from 'src/components/DeployProgressSummary.vue';
import { useEventStore } from 'src/stores/events';
import { formatDateString } from 'src/utils/date';
import { newFatalErrorRouteLocation } from 'src/util/errors';
import { useRouter } from 'vue-router';

const api = useApi();
const eventStore = useEventStore();
const router = useRouter();

const accounts = ref<Account[]>([]);
const filteredAccountList = ref<Account[]>([]);
const deploymentURL = ref('');
const selectedAccount = ref<Account>();
const deployingLocalId = ref('');
const numSuccessfulDeploys = ref(0);

const emit = defineEmits(['deploy']);

const props = defineProps({
  deployment: { type: Object as PropType<Deployment>, required: true },
});

const onChange = (account: Account) => {
  selectedAccount.value = account;
};

const showLogsLink = computed(() => {
  return eventStore.doesPublishStatusApply(props.deployment.id);
});

const routerLocation = computed(() => {
  return {
    name: 'progress',
    query: {
      name: props.deployment.saveName,
      operation: `Redeployment to: ${props.deployment.serverUrl}`,
      id: props.deployment.id,
    },
  };
});

const initiateRedeploy = async() => {
  const accountName = selectedAccount.value?.name;
  if (!accountName) {
    // internal error
    router.push(
      newFatalErrorRouteLocation(
        'An internal error has occurred when calling publish.start - no accountName',
        'ExistingDeploymentHeader::initiateRedeploy()',
      ),
    );
    return; // not reachable but we need this here for intellisense
  }
  emit('deploy');

  // Returns:
  // 200 - success
  // 400 - bad request
  // 500 - internal server error
  // ERROR - pulishing prechecks
  // Errors returned through event stream
  try {
    const result = await eventStore.initiatePublishProcessWithEvents(
      false, // this is never a new deployment
      accountName,
      props.deployment.saveName,
      props.deployment.id,
    );
    deployingLocalId.value = result;
  } catch (error: unknown) {
    // We'll send all errors to the fatal page. Nothing the user can do about this
    // error here. This includes 400 errors.
    router.push(
      newFatalErrorRouteLocation(
        error,
        'ExistingDeploymentHeader::initiateRedeploy()',
      ),
    );
  }
};

const updateAccountList = async() => {
  try {
    // API returns:
    // 200 - success
    // 500 - internal server error
    const response = await api.accounts.getAll();
    accounts.value = response.data.accounts;
  } catch (error: unknown) {
    router.push(newFatalErrorRouteLocation(error, 'ExistingDeploymentHeader::updateAccountList()'));
  }
};
updateAccountList();

watch(
  () => [
    props.deployment.serverUrl,
    accounts.value,
  ],
  () => {
    const credentials = accounts.value.filter(
      (account: Account) => account.url === props.deployment.serverUrl
    );
    filteredAccountList.value = credentials;
  },
  { immediate: true }
);

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
        eventStore.doesPublishStatusApply(deployingLocalId.value) ||
        eventStore.doesPublishStatusApply(props.deployment.id)
      ) &&
      // and it was successful enough to get a content id assigned
      eventStore.currentPublishStatus.contentId
    ) {
      // increment our counter
      numSuccessfulDeploys.value += 1;
    }
  }
);

const showDeployStatusAsCurrent = computed(() => {
  // Show only if we've previously published or if this is the first one,
  // then only if it applies to us.
  return Boolean(
    numSuccessfulDeploys.value ||
    eventStore.doesPublishStatusApply(deployingLocalId.value)
  );
});

</script>

<style scoped lang="scss">
.deployment-header {
  border-bottom: 1px solid;

  .account-width {
    min-width: 300px;
  }
}

.body--light {
  .deployment-header {
    background-color: white;
    border-color: $grey-4;
  }
}

.body--dark {
  .deployment-header {
    border-color: $grey-8;
  }
}
</style>
