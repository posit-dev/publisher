<template>
  <main>
    <vscode-button appearance="primary" style="width: 100%">
      <div style="
        display: flex;
        justify-content: space-between;
        align-content: space-between;
        flex-direction: row;
        align-items: center;
      ">
        Deploy
        <span v-if="toggleMode==='hidden'" style="margin-left: 3rem;" class="codicon codicon-info"
          @click="onToggleParams"></span>
        <span v-if="toggleMode === 'read-only'" style="margin-left: 3rem;" class="codicon codicon-chevron-right"
          @click="onToggleParams"></span>
        <span v-if="toggleMode === 'update'" style="margin-left: 3rem;" class="codicon codicon-chevron-down"
          @click="onToggleParams"></span>
      </div>
    </vscode-button>
    <div v-if="toggleMode === 'read-only'">
      <div>Credential: {{ selectedCredential }}</div>
      <div>Deployment: {{ selectedDeployment }}</div>
      <div>Config: {{ selectedConfig }}
      </div>
    </div>
    <div v-if="toggleMode === 'update'">
      <div class="section">
        <div class="label-and-icons">
          <label for="deployment-selector">Deployment:</label>
          <vscode-button appearance="icon" class="action-icons">
            <span slot="start" class="codicon codicon-add" @click="onAddDeployment"></span>
          </vscode-button>
        </div>
        <vscode-dropdown id="deployment-selector" v-model="selectedDeployment" class="dropdowns">
          <vscode-option v-for="deployment in deploymentList" :key="deployment">
            {{ deployment }}
          </vscode-option>
        </vscode-dropdown>
      </div>

      <div class="section">
        <div class="label-and-icons">
          <label for="config-selector">Configuration:</label>
          <vscode-button appearance="icon" class="action-icons">
            <span slot="start" class="codicon codicon-add" @click="onAddConfiguration"></span>
          </vscode-button>
        </div>
        <vscode-dropdown id="config-selector" v-model="selectedConfig" class="dropdowns">
          <vscode-option v-for="config in configList" :key="config">{{
            config
            }}</vscode-option>
        </vscode-dropdown>
      </div>

      <label for="credentials-selector">Credentials:</label>
      <vscode-dropdown id="credentials-selector" v-model="selectedCredential" class="dropdowns">
        <vscode-option v-for="credential in credentialList" :key="credential">{{
          credential
          }}</vscode-option>
      </vscode-dropdown>
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

type ToggleMode = "hidden" | "read-only" | "update";

let toggleMode = ref<ToggleMode>('hidden');

const onToggleParams = () => {
  switch(toggleMode.value) {
    case "hidden":
      toggleMode.value = "read-only";
      break;
    case "read-only":
      toggleMode.value = "update";
      break;
    case "update":
      toggleMode.value = "hidden";
      break;
  }
}

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
  switch (command) {
    case 'refresh_data': {
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
      break;
    }
    case 'publish_start': {
      publishingInProgress.value = true;
      break;
    }
    case 'publish_finish': {
      publishingInProgress.value = false;
      break;
    }
    case 'update_deployment_selection': {
      const payload = JSON.parse(event.data.payload);
      // Not sure why we can't set this value immediately, even ahead
      // of the refresh which is coming, but what I've found is that you
      // have to wait long enough for the list to render before setting it,
      // otherwise the selector will select the first value in the list.
      // (I've even tried holding off on setting the value until the next refresh
      // comes in, which has the new value included).
      setTimeout(() => {
        selectedDeployment.value = payload.name;
      }, 1000);
      break;
    }
    case 'update_config_selection': {
      const payload = JSON.parse(event.data.payload);
      // Not sure why we can't set this value immediately, even ahead
      // of the refresh which is coming, but what I've found is that you
      // have to wait long enough for the list to render before setting it,
      // otherwise the selector will select the first value in the list.
      // (I've even tried holding off on setting the value until the next refresh
      // comes in, which has the new value included).
      setTimeout(() => {
        selectedConfig.value = payload.name;
      }, 1000);
      break;
    }
    default:
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

const onAddDeployment = () => {
  vsCodeApi.postMessage({
    command: "newDeployment",
  });
}

const onAddConfiguration = () => {
  vsCodeApi.postMessage({
    command: "newConfiguration",
  });
}

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

<style lang="scss">
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
.label-and-icons {
  display: flex;
  justify-content: space-between;
  align-content: center;
  flex-direction: row;
  flex-wrap: nowrap;
  min-width: 100%;
  align-items: center;
}
.action-icons {
  width: 20px;
}
.section {
  min-width: 100%;
}
</style>
