<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="deployment-header">
    <div class="publisher-layout q-py-md">
      <q-breadcrumbs>
        <q-breadcrumbs-el>
          <PLink :to="{ name: 'project' }">
            Project
          </PLink>
        </q-breadcrumbs-el>
        <q-breadcrumbs-el
          label="Deploy"
        />
      </q-breadcrumbs>

      <div
        class="flex justify-between q-mt-md row-gap-lg column-gap-xl"
      >
        <div class="space-between-y-sm">
          <h1 class="text-h6">
            {{ deployment.saveName }}
          </h1>
          <p>
            Deploying to: <a
              :href="deployment.serverUrl"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ deployment.serverUrl }}
            </a>
          </p>
          <template v-if="isDeployment(deployment)">
            <p>
              {{ deployment.id }}
            </p>
            <p>
              Last Deployed on {{ formatDateString(deployment.deployedAt) }}
            </p>
          </template>
          <template v-else>
            <p>
              An ID will be created on first deployment.
            </p>
            <p>
              This project has never been deployed using these credentials
            </p>
          </template>
        </div>

        <div
          class="flex no-wrap items-start"
        >
          <SelectAccount
            class="account-width"
            :accounts="filteredAccountList"
            :preferred-account="props.preferredAccount"
            :url="deployment.serverUrl"
            @change="onChange"
          />
          <PButton
            hierarchy="primary"
            class="q-ml-md"
            padding="sm md"
            data-automation="redeploy"
            :disable="Boolean(configError) || eventStore.publishInProgess"
            @click="initiateDeployment"
          >
            <q-tooltip
              v-if="redeployDisableTitle"
              class="text-body2"
            >
              {{ redeployDisableTitle }}
            </q-tooltip>
            {{ deploymentLabel }}
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
                :id="summaryStatusId"
                :current-tense="showDeployStatusAsCurrent"
              />
              <PLink
                v-if="progressLink"
                :to="progressLink"
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

import { ref, watch, PropType, computed } from 'vue';

import {
  Account,
  ConfigurationError,
  Deployment,
  PreDeployment,
  useApi,
  isDeployment,
  isPreDeployment
} from 'src/api';
import PLink from 'src/components/PLink.vue';
import SelectAccount from 'src/components/SelectAccount.vue';
import PButton from 'src/components/PButton.vue';
import DeployProgressSummary from 'src/components/DeployProgressSummary.vue';
import { useEventStore } from 'src/stores/events';
import { formatDateString } from 'src/utils/date';
import { newFatalErrorRouteLocation } from 'src/utils/errors';
import { useRouter } from 'vue-router';

const api = useApi();
const eventStore = useEventStore();
const router = useRouter();

const accounts = ref<Account[]>([]);
const filteredAccountList = ref<Account[]>([]);
const selectedAccount = ref<Account>();
const deployingLocalId = ref('');
const numSuccessfulDeploys = ref(0);

const emit = defineEmits(['deploy']);

const props = defineProps({
  deployment: { type: Object as PropType<Deployment | PreDeployment>, required: true },
  configError: {
    type: Object as PropType<ConfigurationError>,
    required: false,
    default: undefined
  },
  preferredAccount: { type: String, required: false, default: undefined },
});

const onChange = (account: Account) => {
  selectedAccount.value = account;
};

const deploymentLabel = computed(() => {
  return isPreDeployment(props.deployment) ?
    'Deploy' :
    'Redeploy';
});

const progressLink = computed(() => {
  if (isPreDeployment(props.deployment)) {
    return undefined;
  }

  if (eventStore.doesPublishStatusApply(props.deployment.id)) {
    return {
      name: 'progress',
      query: {
        operation: operationStr.value,
        id: props.deployment.id,
      },
    };
  }

  return undefined;
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

const operationStr = computed(() => {
  return `Deploying to: ${props.deployment.serverUrl}`;
});

const summaryStatusId = computed(() => {
  return isDeployment(props.deployment) ?
    props.deployment.id :
    deployingLocalId.value;
});

const initiateDeployment = async() => {
  const accountName = selectedAccount.value?.name;
  const destinationURL = selectedAccount.value?.url;
  if (!accountName) {
    // internal error
    router.push(
      newFatalErrorRouteLocation(
        'An internal error has occurred when calling publish.start - no accountName',
        'DeploymentHeader::initiateDeployment()',
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
      accountName,
      props.deployment.saveName,
      destinationURL,
      isDeployment(props.deployment) ? props.deployment.id : undefined,
    );
    deployingLocalId.value = result;
  } catch (error: unknown) {
    // We'll send all errors to the fatal page. Nothing the user can do about this
    // error here. This includes 400 errors.
    router.push(
      newFatalErrorRouteLocation(
        error,
        'DeploymentHeader::initiateDeployment()',
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
    router.push(newFatalErrorRouteLocation(error, 'DeploymentHeader::updateAccountList()'));
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
        (
          isDeployment(props.deployment) &&
          eventStore.doesPublishStatusApply(props.deployment.id)
        )
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
    background-color: var(--vscode-editor-background, white);
    border-color: $grey-4;
  }
}

.body--dark {
  .deployment-header {
    border-color: $grey-8;
  }
}
</style>
