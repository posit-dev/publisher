<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="deployment-header">
    <div class="publisher-layout q-py-md">
      <q-breadcrumbs>
        <q-breadcrumbs-el
          label="Project"
          :to="{ name: 'project' }"
        />
        <q-breadcrumbs-el
          label="Deploy"
        />
      </q-breadcrumbs>

      <div
        class="flex justify-between q-mt-md row-gap-lg column-gap-xl"
      >
        <div class="space-between-y-sm">
          <h1
            v-if="deploymentName"
            class="text-h6"
          >
            {{ deploymentName }}
          </h1>
          <template v-if="deployAsNew">
            <p>
              New deployment to: {{ deploymentURL }}
            </p>
            <p>
              {{ addingDeploymentMessage }}
            </p>
          </template>
          <template v-else>
            <p>
              Deployment to: {{ deploymentURL }}
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
            :url="deploymentURL"
          />
          <PButton
            hierarchy="primary"
            class="q-ml-md"
            padding="sm md"
            data-automation="deploy"
            :disable="Boolean(configError) || eventStore.publishInProgess || !deploymentName"
            @click="initiateDeploy"
          >
            <q-tooltip
              v-if="redeployDisableTitle"
              class="text-body2"
            >
              {{ redeployDisableTitle }}
            </q-tooltip>
            {{ deployAsNew ? 'Deploy' : 'Redeploy' }}
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
                :id="deployingLocalId"
                :current-tense="showDeployStatusAsCurrent"
              />
              <PLink
                v-if="showLogsLink"
                :to="{name: 'progress'}"
              >
                View summarized deployment logs
              </PLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import { PropType, computed, ref, watch } from 'vue';
import { Account, ConfigurationError, useApi } from 'src/api';

import PLink from 'src/components/PLink.vue';
import SelectAccount from 'src/components/SelectAccount.vue';
import DeployProgressSummary from 'src/components/DeployProgressSummary.vue';

import { useEventStore } from 'src/stores/events';
import {
  newFatalErrorRouteLocation,
} from 'src/utils/errors';
import { useRouter } from 'vue-router';
import PButton from 'src/components/PButton.vue';

const api = useApi();
const eventStore = useEventStore();
const router = useRouter();

const accounts = ref<Account[]>([]);
const fixedAccountList = ref<Account[]>([]);
const deploymentURL = ref('');
const deployingLocalId = ref('');
const contentId = ref('');
const numSuccessfulDeploys = ref(0);

const emit = defineEmits(['deploy']);

const props = defineProps({
  accountName: { type: String, required: true },
  deploymentName: { type: String, default: undefined, required: false },
  configError: {
    type: Object as PropType<ConfigurationError>,
    required: false,
    default: undefined
  },
});

const showLogsLink = computed(() => {
  return eventStore.doesPublishStatusApply(deployingLocalId.value);
});

const redeployDisableTitle = computed(() => {
  if (eventStore.publishInProgess) {
    return 'Another deployment is in progress';
  }
  if (props.configError) {
    return 'Cannot deploy with configuration errors';
  }
  return undefined;
});

const initiateDeploy = async() => {
  if (props.deploymentName === undefined) {
    return;
  }
  emit('deploy');
  // Returns:
  // 200 - success
  // 400 - bad request
  // 500 - internal server error
  // ERROR - publishing checks
  // Errors returned through event stream
  try {
    const result = await eventStore.initiatePublishProcessWithEvents(
      deployAsNew.value,
      props.accountName,
      props.deploymentName,
      deploymentURL.value,
      contentId.value,
    );
    deployingLocalId.value = result;
  } catch (error: unknown) {
    // Send all errors to the fatal error page. There is nothing the user can do here
    // easily. This includes 400 errors.
    router.push(
      newFatalErrorRouteLocation(
        error,
        'NewDeploymentHeader::initiateDeploy()'
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
      deploymentURL.value = response.data.url;
      fixedAccountList.value = [response.data];
    }
  } catch (error: unknown) {
    // send all errors, including 404, to the fatal error page.
    router.push(
      newFatalErrorRouteLocation(
        error,
        'NewDeploymentHeader::updateAccountList()',
      ),
    );
  }
};

const addingDeploymentMessage = computed(() => {
  if (props.deploymentName) {
    return `Deploying will add a deployment named "${props.deploymentName}" to your project.`;
  }
  return 'Deploying will add this deployment to your project.';
});

const showDeployStatusAsCurrent = computed(() => {
  // Show only if we've previously deployed or if this is the first one,
  // then only if it applies to us.
  return Boolean(
    numSuccessfulDeploys.value ||
    eventStore.doesPublishStatusApply(deployingLocalId.value)
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
        eventStore.doesPublishStatusApply(deployingLocalId.value) ||
        eventStore.doesPublishStatusApply(contentId.value)
      ) &&
      // and it was successful enough to get a content id assigned
      eventStore.currentPublishStatus.contentId
    ) {
      // increment our counter
      numSuccessfulDeploys.value += 1;
    }
  }
);

const deployAsNew = computed(() => {
  return numSuccessfulDeploys.value === 0;
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
