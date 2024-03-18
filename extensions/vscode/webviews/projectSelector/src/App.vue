<template>
  <main>
    <h1>Deploy Your Project</h1>

    <label for="deployment-selector">Deployment:</label>
    <vscode-dropdown id="deployment-selector" v-model="selectedDeployment" class="dropdowns">
      <vscode-option v-for="deployment in deploymentList" :key="deployment">{{
        deployment
      }}</vscode-option>
    </vscode-dropdown>

    <label for="config-selector">Configuration:</label>
    <vscode-dropdown id="config-selector" v-model="selectedConfig" class="dropdowns">
      <vscode-option v-for="config in configList" :key="config">{{
        config
      }}</vscode-option>
    </vscode-dropdown>

    <label for="credentials-selector">Credentials:</label>
    <vscode-dropdown id="credentials-selector" v-model="selectedCredential" class="dropdowns">
      <vscode-option v-for="credential in credentialList" :key="credential">{{
        credential
      }}</vscode-option>
    </vscode-dropdown>

    <div class="roomy">
      <vscode-button
        v-if="!publishingInProgress"
        :disabled="disableDeployment"
        @click="handleDeployClick"
      >
        Deploy Your Project!
      </vscode-button>
      <div 
        v-else
        style="display: flex; flex-direction: row; align-items: center;"
      >
        <vscode-progress-ring style="margin-right: 1rem;"/>
        Deployment in Progress...
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onBeforeUnmount, ref } from "vue";
import {
  provideVSCodeDesignSystem,
  vsCodeButton,
  vsCodeDropdown,
  vsCodeOption,
  vsCodeProgressRing,
} from "@vscode/webview-ui-toolkit";

// In order to use the Webview UI Toolkit web components they
// must be registered with the browser (i.e. webview) using the
// syntax below.
provideVSCodeDesignSystem().register(
  vsCodeButton(),
  vsCodeDropdown(),
  vsCodeOption(),
  vsCodeProgressRing(),
);

// need access to the global window variable
declare var window: any;

let deploymentList = ref<string[]>([]);
let configList = ref<string[]>([]);
let credentialList = ref<string[]>([]);
let publishingInProgress = ref(false);

const selectedDeployment = ref<string>();
const selectedConfig = ref<string>();
const selectedCredential = ref<string>();


const vsCodeApi = acquireVsCodeApi();

const handleMessageFromProvider = (event: any) => {
  const command = event.data.command;
  if (command === 'refresh_data') {
    console.log(event.data.payload);
    const payload = JSON.parse(event.data.payload);

    deploymentList.value = payload.deployments;
    if (!selectedDeployment.value) {
      selectedDeployment.value = deploymentList.value[0];
    }
    if (deploymentList.value.length === 0) {
      selectedDeployment.value = '';
    }

    configList.value = payload.configurations;
    if (!selectedConfig.value) {
      selectedConfig.value = configList.value[0];
    }
    if (configList.value.length === 0) {
      selectedConfig.value = '';
    }

    credentialList.value = payload.credentials
    if (!selectedCredential.value) {
      selectedCredential.value = credentialList.value[0];
    }
    if (credentialList.value.length === 0) {
      selectedCredential.value = '';
    }
  } else if (command === 'publish_start') {
    publishingInProgress.value = true;
  } else if (command === 'publish_finish') {
    publishingInProgress.value = false;
  } else {
    console.log(`unexpected command: ${command}`);
  }
};

const handleDeployClick = () => {
  vsCodeApi.postMessage({
    command: "deploy",
    payload: JSON.stringify({
      deployment: selectedDeployment.value,
      configuration: selectedConfig.value,
      credential: selectedCredential.value,
    }),
  });
};

const disableDeployment = computed(() => {
  console.log(`selectedDeployment: ${selectedDeployment.value}: ${!Boolean(selectedDeployment.value)}`);
  console.log(`selectedConfig: ${selectedConfig.value}: ${!Boolean(selectedConfig.value)}`);
  console.log(`selectedCredential: ${selectedCredential.value}: ${!Boolean(selectedCredential.value)}`);
  const result = (
    !Boolean(selectedDeployment.value) ||
    !Boolean(selectedConfig.value) ||
    !Boolean(selectedCredential.value)
  );
  console.log(`disableDeployment: ${result}`);
  return result;
})

onBeforeMount(() => {
  // Register for our messages from the provider
  window.addEventListener("message", handleMessageFromProvider);

  // Send the message which will caue the provider to send us
  // our data back
  vsCodeApi.postMessage({
    command: "initializing",
  });
});

onBeforeUnmount(() => {
  window.removeEventListener("message", handleMessageFromProvider);
});

</script>

<style>
main {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  height: 100%;
}
.roomy {
  margin: 0.5rem 0;
  min-width: 100%;
}
.dropdowns {
  width: 100%;
  margin: 0.5rem 0 1rem 0;
}
</style>
