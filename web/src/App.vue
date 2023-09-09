<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-layout
    view="lhh LpR lff"
    class="bg-grey-9 text-white"
  >
    <q-header
      elevated
      class="bg-primary text-white"
    >
      <q-toolbar class="max-width-md q-mx-auto">
        <!-- <WhitePositLogo
          class="posit-logo"
          alt="Posit PBC Logo"
        /> -->
        <div
          style=""
          class="text-white row"
        >
          <q-btn
            flat
            icon="menu"
            @click="menu = !menu"
          >
            <q-menu dark>
              <q-list style="min-width: 100px" class="q-pa-sm">
                <q-item
                  v-close-popup
                  clickable
                  class="q-my-sm"
                >
                  <q-item-section>Overview</q-item-section>
                </q-item>
                <q-item
                  v-close-popup
                  clickable
                  class="q-my-sm"
                >
                  <q-item-section>Posit Publishing FAQs</q-item-section>
                </q-item>
                <q-separator dark />
                <q-item
                  v-close-popup
                  clickable
                  class="q-my-sm"
                  @click="showDebug = !showDebug"
                >
                  <q-item-section>{{ !showDebug ? "Show Debug Console" : "Hide Debug Console" }} </q-item-section>
                </q-item>
                <q-item
                  v-close-popup
                  clickable
                  class="q-my-sm"
                >
                  <q-item-section>Create Diagnostic Bundle</q-item-section>
                </q-item>
                <q-separator dark />
                <q-item
                  v-close-popup
                  clickable
                  class="q-my-sm"
                >
                  <q-item-section>About</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </div>
        <q-toolbar-title>
          Publisher
        </q-toolbar-title>
      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="showDebug"
      side="right"
      bordered
      :width="drawerWidth"
      dark
      :overlay="overlayMode"
    >
      <q-toolbar class="bg-orange shadow-2 rounded-borders">
        <div class="q-pa-sm col">
          DEBUG
        </div>
        <q-space />
        <q-btn-toggle
          v-model="debugModel"
          push
          flat
          outline
          no-caps
          toggle-color="primary"
          :options="[
            {label: 'Agent', value: 'agent'},
            {label: 'Events', value: 'events'},
            {label: 'Diagnostics', value: 'diagnostics'}
          ]"
        />
        <q-btn
          icon="close"
          flat
          @click="showDebug = false"
        />
      </q-toolbar>
      <q-scroll-area class="fit">
        <div class="q-pa-sm">
          <div
            v-for="n in 50"
            :key="n"
            ark
          >
            {{ debugModel }} log: drawer {{ n }} / 50
          </div>
        </div>
      </q-scroll-area>
    </q-drawer>

    <q-page-container>
      <q-page
        v-if="!showPublishing"
        class="max-width-md q-mx-auto"
        padding
      >
        <q-tabs
          v-model="tab"
          dense
          class="text-grey"
          active-color="white"
          active
          indicator-color="primary"
          align="justify"
          narrow-indicator
        >
          <q-tab
            name="newDeployment"
            label="New Deployment"
            dark
          />
          <q-tab
            name="updateDeployment"
            label="Update Existing Deployment"
            dark
          />
        </q-tabs>
        <q-separator />

        <q-tab-panels
          v-model="tab"
          animated
          dark
        >
          <q-tab-panel name="newDeployment">
            <div class="q-mx-md q-mb-md">
              Your project will be published to the Posit Connect server as a new deployment.
              Update the information below and then click the Publish button to begin the process.
            </div>
            <q-list
              dark
              class="rounded-borders"
            >
              <ContentTarget
                :show-title="true"
                @publish="onPublish"
              />
              <div class="q-mx-md q-mt-xl q-mb-sm">
                Customize your deployment on the server by expanding any of the sections below.
              </div>
              <q-separator
                dark
                class="q-mx-md"
              />
              <DestinationTarget />
              <q-separator
                dark
                class="q-mx-md"
              />
              <FilesToPublish :redeploy="false" />
              <q-separator
                dark
                class="q-mx-md"
              />
              <PythonProject />
              <q-separator
                dark
                class="q-mx-md"
              />
              <CommonSettings :redeploy="false" />
              <q-separator
                dark
                class="q-mx-md"
              />
              <AdvancedSettings />
              <q-separator
                dark
                class="q-mx-md"
              />
            </q-list>
          </q-tab-panel>

          <q-tab-panel name="updateDeployment">
            <div class="q-mx-md q-mb-md">
              Your project will be published to the Posit Connect server as an update to the existing
              instance of this deployment. Update the information below and then click the Publish
              button to begin the process.
            </div>
            <q-list
              dark
              class="rounded-borders"
            >
              <ContentTarget
                :show-title="false"
                @publish="onPublish"
              />
              <div class="q-mx-md q-mt-xl q-mb-sm">
                Customize your deployment on the server by expanding any of the sections below.
              </div>
              <q-separator
                dark
                class="q-mx-md"
              />
              <FilesToPublish :redeploy="true" />
              <q-separator
                dark
                class="q-mx-md"
              />
              <PythonProject />
              <q-separator
                dark
                class="q-mx-md"
              />
              <CommonSettings :redeploy="true" />
              <q-separator
                dark
                class="q-mx-md"
              />
              <AdvancedSettings />
              <q-separator
                dark
                class="q-mx-md"
              />
            </q-list>
          </q-tab-panel>
        </q-tab-panels>
      </q-page>
      <q-page
        v-if="showPublishing"
        class="max-width-md q-mx-auto"
        padding
        dark
      >
        <!-- <q-banner
          v-if="activeSummaryStep === 9"
          class="bg-primary text-white q-px-lg"
        >
          <div class="row justify-between">
            <div class="col-8">
              Your project has been successfully deployed to the server and is
              available at https://connect.abc.com/my-project
            </div>
            <div class="col-2">
              <q-btn
                v-if="!publishingInProgress"
                color="primary"
                label="Exit"
                class="q-mb-sm q-px-lg"
              />
            </div>
          </div>
        </q-banner> -->
        <!-- <div
          v-if="activeSummaryStep < 9"
          class="row center"
        >
          <div class="q-ma-md col-8">
            Publishing 'fastapi-simple' to Dogfood
            <q-spinner-ios
              v-if="publishingInProgress"
              color="yellow"
              size="md"
              class="q-ml-sm"
            />
          </div>
        </div> -->
        
        <q-tabs
          v-model="publishingTab"
          dense
          class="text-grey"
          active-color="white"
          indicator-color="primary"
          align="justify"
          narrow-indicator
        >
          <q-tab
            name="summary"
            label="Summary View"
            dark
          />
          <q-tab
            name="advanced"
            label="Advanced Log View"
            dark
          />
        </q-tabs>
        <q-tab-panels
          v-model="publishingTab"
          animated
          dark
        >
          <q-tab-panel name="summary">
            <div style="background-color: rgb(29, 29, 29);">
              <h6
                v-if="publishingInProgress"
                class="q-pa-sm"
                style="margin-bottom: 0px; margin-top: 0;"
              >
                Publishing 'fastapi-simple' to Dogfood...
              </h6>
              <h6
                v-if="!publishingInProgress"
                class="q-pa-sm"
                style="margin-bottom: 0px; margin-top: 0;"
              >
                'fastapi-simple' has been published to Dogfood
              </h6>
              <div class="row items-center">
                <ul class="col-8">
                  <li>Target: Dogfood Posit Connect Server as 'admin'</li>
                  <li>Files: 5 files from project/XYZ</li>
                  <li>Python: Version 3.9.5</li>
                  <li>Environment: 15 python packages to be installed</li>
                  <li>Vanity URL: http://dogfood:3939/my-special-app</li>
                </ul>
                <q-spinner-gears
                  v-if="publishingInProgress"
                  color="light-blue-3"
                  size="xl"
                  class="q-ml-sm col-1"
                />
                <div
                  v-if="!publishingInProgress"
                  class="q-my-md col"
                >
                  <div class="row items-center">
                    <q-btn
                      color="secondary"
                      label="Return to Publishing"
                      class="q-mr-md q-mb-sm"
                      style="width: 100%"
                      @click="showPublishing = false"
                    />
                  </div>
                  <div class="row items-center">
                    <q-btn
                      color="primary"
                      label="Navigate To Content"
                      class="q-mr-md q-mt-sm"
                      style="width: 100%"
                      @click="onExit"
                    />
                  </div>
                </div>
              </div>
            </div>
            <q-stepper
              v-model="activeSummaryStep"
              vertical
              animated
              dark
              flat
            >
              <q-step
                :name="1"
                title="Create Deployment"
                icon="create_new_folder"
                color="grey-5"
                active-color="light-blue-3"
                done-color="white"
                :done="activeSummaryStep > 1"
              >
                Registering the deployment object with the Posit Connect Server.
              </q-step>
              <q-step
                :name="2"
                title="Create Bundle"
                icon="compress"
                color="grey-5"
                active-color="light-blue-3"
                done-color="white"
                :done="activeSummaryStep > 2"
              >
                Collecting and bundling up the files included in your project, so that
                they can be uploaded to the server within a bundle.
              </q-step>
              <q-step
                :name="3"
                title="Upload Bundle"
                icon="login"
                color="grey-5"
                active-color="light-blue-3"
                done-color="white"
                :done="activeSummaryStep > 3"
              >
                Transferring the files from your local workstation to the server.
              </q-step>
              <q-step
                :name="4"
                title="Deploy Bundle"
                icon="publish"
                color="grey-5"
                active-color="light-blue-3"
                done-color="white"
                :done="activeSummaryStep > 4"
              >
                Associating the uploaded bundle with the deployment object.
              </q-step>
              <q-step
                :name="5"
                title="Restore Python Environment"
                :caption="pythonRestoreStatus"
                icon="move_down"
                color="grey-5"
                active-color="light-blue-3"
                done-color="white"
                :done="activeSummaryStep > 5"
              >
                Installing the dependent python packages on the server in order
                to reproduce your runtime environment.
              </q-step>
              <q-step
                :name="6"
                title="Run Content"
                icon="sync"
                color="grey-5"
                active-color="light-blue-3"
                done-color="white"
                :done="activeSummaryStep > 6"
              >
                Performing execution checks ahead of applying settings.
              </q-step>
              <q-step
                :name="7"
                title="Set Vanity URL"
                icon="settings"
                color="grey-5"
                active-color="light-blue-3"
                done-color="white"
                :done="activeSummaryStep > 7"
              >
                Configuring the Vanity URL for your content.
              </q-step>
              <q-step
                :name="8"
                title="Wrapping up Deployment"
                caption="Success"
                color="grey-5"
                active-color="light-blue-3"
                done-color="white"
                :done="activeSummaryStep >= 8"
              >
                Your project has been successfully deployed to the server and is
                available at https://rsc.radixu.com/connect/my-project
              </q-step>
            </q-stepper>
          </q-tab-panel>
          <q-tab-panel
            name="advanced"
          >
            <div
              v-if="!publishingInProgress"
              class="row justify-between q-mb-md"
            >
              <div class="col-5">
                <q-btn
                  color="secondary"
                  label="Return to Publishing"
                  class=""
                  style="width: 100%"
                  @click="showPublishing = false"
                />
              </div>
              <div class="col-5">
                <q-btn
                  color="primary"
                  label="Navigate To Content"
                  class=""
                  style="width: 100%"
                  @click="onExit"
                />
              </div>
            </div>
            <q-separator
              dark
              class="q-ma-md"
            />
            <div class="text-center q-mt-md" style="font-size: larger">
              Publish 'fastapi-simple' to Dogfood
            </div>
            <q-list
              dark
              class="q-mt-md"
              bordered
            >
              <div
                v-for="(log, index) in advancedLog"
                :key="index"
              >
                <q-item
                  v-if="log.type === 'event'"
                  class="bg-blue-grey-7 text-white"
                  dark
                  dense
                >
                  <q-item-section>
                    {{ log.msg }}
                  </q-item-section>
                </q-item>
                <q-item
                  v-if="log.type === 'info'"
                  class="q-my-sm"
                  dark
                  dense
                  style="line-height: 1rem;"
                >
                  <q-item-section>
                    {{ log.msg }}
                  </q-item-section>
                </q-item>
                <!-- <q-expansion-item
                  v-if="log.type === 'info'"
                  dense
                  dense-toggle
                  expand-separator
                  icon=""
                  :label="log.msg"
                  dark
                  style="font-size: small;"
                  class="q-my-sm"
                >
                  <q-item
                    v-for="key in Object.keys(log.data)"
                    :key="key"
                    dark
                    dense
                    class="q-ml-md row"
                    style="color: lightsteelblue; line-height: 1.5rem !important;"
                  >
                    <div class="col-2">
                      {{ key }}:
                    </div>
                    <div class="col">
                      {{ log.data[key] }}
                    </div>
                  </q-item>
                </q-expansion-item> -->
              </div>
            </q-list>
          </q-tab-panel>
        </q-tab-panels>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import ContentTarget from 'src/components/panels/ContentTarget.vue';
import DestinationTarget from 'src/components/panels/DestinationTarget.vue';
import FilesToPublish from 'src/components/panels/FilesToPublish.vue';
import PythonProject from 'src/components/panels/PythonProject.vue';
import CommonSettings from 'src/components/panels/CommonSettings.vue';
import AdvancedSettings from 'src/components/panels/AdvancedSettings.vue';
// import PublishProcess from 'src/components/PublishProcess.vue';
// import WhitePositLogo from 'src/components/icons/WhitePositLogo.vue';

// import { matMenu } from '@quasar/extras/material-icons';

import { ref, onMounted, onUnmounted, computed } from 'vue';

import { useApi } from 'src/api';
import { useDeploymentStore } from 'src/stores/deployment';

const api = useApi();
const deploymentStore = useDeploymentStore();

const tab = ref('newDeployment');
const publishingTab = ref('summary');
const menu = ref(false);
const showDebug = ref(false);
const debugModel = ref('one');
const showPublishing = ref(false);
const activeSummaryStep = ref(0);
const pythonRestoreStatus = ref('');
const publishingInProgress = ref(true);

const windowWidth = ref(window.innerWidth);
const windowHeight = ref(window.innerHeight);

const handleResize = () => {
  windowWidth.value = window.innerWidth;
  windowHeight.value = window.innerHeight;
};

const onExit = () => {
  window.location.href = 'http://dogfood:3939/my-special-app';
};

const getInitialDeploymentState = async() => {
  const { data: deployment } = await api.deployment.get();
  deploymentStore.deployment = deployment;
};

onMounted(() => {
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

const onPublish = () => {
  showPublishing.value = true;
  publishingInProgress.value = true;
  activeSummaryStep.value = 0;
  currentStatus = -1;
  publishingTab.value = 'summary';

  const interval = setInterval(() => {
    if (activeSummaryStep.value === 5) {
      pythonRestoreStatus.value = getNextPublishStatus();
      if (pythonRestoreStatus.value === '') {
        activeSummaryStep.value += 1;
      }
    } else if (activeSummaryStep.value === 9) {
      publishingInProgress.value = false;
      clearInterval(interval);
    } else {
      activeSummaryStep.value += 1;
    }
  }, 500);
};

let currentStatus = -1;

const restoreStatus = [
  'Installing package: anyio (v3.6.2)',
  'Installing package: asgiref (v3.6.0)',
  'Installing package: anyio (v2.1.2)',
  'Installing package: click (v8.1.3)',
  'Installing package: fastapi (v0.95.2)',
  'Installing package: h11 (v0.14.0)',
  'Installing package: idna (v3.4)',
  'Installing package: pydantic (v1.10.7)',
  'Installing package: pyjwt v(2.7.0)',
  'Installing package: rsconnect-python v(1.17.0)',
  'Installing package: semver (v2.13.0)',
  'Installing package: six (v1.16.0)',
  'Installing package: sniffio (v1.3.0)',
  'Installing package: starlette (v0.27.0)',
  'Installing package: typing-extensions (v4.5.0)',
  'Installing package: uvicorn (v0.22.0)',
];
const getNextPublishStatus = () : string => {
  currentStatus += 1;
  if (currentStatus < restoreStatus.length) {
    return restoreStatus[currentStatus];
  }
  return '';
};

// if width < 848, use overlay mode
const overlayMode = computed(() => {
  return windowWidth.value < 848;
});

const drawerWidth = computed(() => {
  if (overlayMode.value) {
    return 400;
  }
  return windowWidth.value / 2;
});

type NameValuePairsMap = {
    [id: string]: string | number;
}

type LogEntry = {
  type: 'event' | 'info' | 'error',
  msg: string,
  data: NameValuePairsMap,
}

const advancedLog:LogEntry[] = [
  {
    type: 'event',
    msg: 'Create Deployment',
    data: {
      time: '2023-08-31T17:55:19.777Z',
    },
  },
  {
    type: 'info',
    msg: 'Loading rsconnect accounts from /Users/billsager/Library/Preferences/org.R-project.R/R/rsconnect',
    data: {
      time: '2023-08-31T17:55:19.777Z',
    },
  },
  {
    type: 'info',
    msg: 'Loading rsconnect-python accounts from /Users/billsager/Library/Application Support/rsconnect-python/servers.json',
    data: {
      time: '2023-08-31T17:55:19.792Z',
    }
  },
  {
    type: 'event',
    msg: 'Create Bundle',
    data: {
      time: '2023-08-31T17:55:19.794Z',
    }
  },
  // entry modified to have directory name included
  {
    type: 'info',
    msg: 'Creating bundle from directory: fastapi-simple',
    data: {
      time: '2023-08-31T17:55:19.794Z',
      sourceDir: '/Users/billsager/dev/publishing-client/test/sample-content/fastapi-simple',
    },
  },
  // entry modified to have file name included
  {
    type: 'info',
    msg: 'Adding file: requirements.txt',
    data: {
      time: '2023-08-31T17:55:19.794Z',
      path: '/Users/billsager/dev/publishing-client/test/sample-content/fastapi-simple/requirements.txt',
      size: 235,
    },
  },
  // entry modified to have file name included
  {
    type: 'info',
    msg: 'Adding file: simple.py',
    data: {
      time: '2023-08-31T17:55:19.796Z',
      path: '/Users/billsager/dev/publishing-client/test/sample-content/fastapi-simple/simple.py',
      size: 369,
    },
  },
  // entry modified to have file name included
  {
    type: 'info',
    msg: 'Adding file: meta.yaml',
    data: {
      time: '2023-08-31T17:55:19.796Z',
      path: '/Users/billsager/dev/publishing-client/test/sample-content/fastapi-simple/meta.yaml',
      size: 63,
    },
  },
  // entry modified to have file name included
  {
    type: 'info',
    msg: 'Adding file: requirements.ini',
    data: {
      time: '2023-08-31T17:55:19.797Z',
      path: '/Users/billsager/dev/publishing-client/test/sample-content/fastapi-simple/requirements.ini',
      size: 124,
    },
  },
  {
    type: 'info',
    msg: 'Bundle created',
    data: {
      time: '2023-08-31T17:55:19.797Z',
      files: '4',
      totalBytes: 791,
    },
  },
  {
    type: 'event',
    msg: 'Upload Bundle',
    data: {
      time: '2023-08-31T17:55:19.797Z',
    }
  },
  {
    type: 'info',
    msg: 'Uploading Bundle to server.',
    data: {
      time: '2023-08-31T17:55:19.797Z',
    }
  },
  {
    type: 'event',
    msg: 'Deploy Bundle',
    data: {
      time: '2023-08-31T17:55:21.066Z',
    }
  },
  {
    type: 'info',
    msg: 'Building FastAPI application...',
    data: {
      time: '2023-08-31T17:55:21.066Z',
      bundleId: 39787,
      contentId: '673e277c-0148-42eb-b2a2-d70f8e6b455d',
      server: 'https://rsc.radixu.com',
      source: 'server deployment log',
      taskId: 'p8HpEBKjvRphdVPz',
    },
  },
  {
    type: 'info',
    msg: 'Bundle created with Python version 3.9.10 is compatible with environment Local with Python version 3.9.7 from /opt/python/3.9.7/bin/python3.9 ',
    data: {
      time: '2023-08-31T17:55:21.066Z',
      bundleId: 39787,
      contentId: '673e277c-0148-42eb-b2a2-d70f8e6b455d',
      server: 'https://rsc.radixu.com',
      source: 'server deployment log',
      taskId: 'p8HpEBKjvRphdVPz',
    },
  },
  {
    type: 'info',
    msg: 'Bundle requested Python version 3.9.10; using /opt/python/3.9.7/bin/python3.9 which has version 3.9.7',
    data: {
      time: '2023-08-31T17:55:21.066Z',
      bundleId: 39787,
      contentId: '673e277c-0148-42eb-b2a2-d70f8e6b455d',
      server: 'https://rsc.radixu.com',
      source: 'server deployment log',
      taskId: 'p8HpEBKjvRphdVPz',
    },
  },
  {
    type: 'info',
    msg: 'Content GUID: 673e277c-0148-42eb-b2a2-d70f8e6b455d',
    data: {
      time: '2023-08-31T17:55:21.066Z',
      bundleId: 39787,
      contentId: '673e277c-0148-42eb-b2a2-d70f8e6b455d',
      server: 'https://rsc.radixu.com',
      source: 'server deployment log',
      taskI: 'p8HpEBKjvRphdVPz',
    },
  },
  {
    type: 'info',
    msg: 'Content ID: 23719',
    data: {
      time: '2023-08-31T17:55:21.066Z',
      bundleId: '39787',
      contentId: '673e277c-0148-42eb-b2a2-d70f8e6b455d',
      server: 'https://rsc.radixu.com',
      source: 'server deployment log',
      taskId: 'p8HpEBKjvRphdVPz',
    },
  },
  {
    type: 'info',
    msg: 'Bundle ID: 39787',
    data: {
      time: '2023-08-31T17:55:21.066Z',
      bundleId: 39787,
      contentId: '673e277c-0148-42eb-b2a2-d70f8e6b455d',
      server: 'https://rsc.radixu.com',
      source: 'server deployment log',
      taskId: 'p8HpEBKjvRphdVPz',
    },
  },
  {
    type: 'info',
    msg: 'Job Key: n8E1fjfUwdkfbQIT',
    data: {
      time: '2023-08-31T17:55:21.066Z',
      bundleId: 39787,
      contentId: '673e277c-0148-42eb-b2a2-d70f8e6b455d',
      server: 'https://rsc.radixu.com',
      source: 'server deployment log',
      taskId: 'p8HpEBKjvRphdVPz',
    },
  },
  {
    type: 'info',
    msg: 'Running on host: dogfood01',
    data: {
      time: '2023-08-31T17:55:21.769Z',
      bundleId: 39787,
      contentId: '673e277c-0148-42eb-b2a2-d70f8e6b455d',
      server: 'https://rsc.radixu.com',
      source: 'server deployment log',
      taskId: '8HpEBKjvRphdVPz',
    },
  },
  {
    type: 'info',
    msg: 'Linux distribution: Ubuntu 22.04.2 LTS (jammy)',
    data: {
      time: '2023-08-31T17:55:21.769Z',
      bundleId: 39787,
      contentId: '673e277c-0148-42eb-b2a2-d70f8e6b455d',
      server: 'https://rsc.radixu.com',
      source: 'server deployment log',
      taskId: 'p8HpEBKjvRphdVPz',
    },
  },
  {
    type: 'info',
    msg: 'Running as user: uid=1031(rstudio-connect) gid=999(rstudio-connect) groups=999(rstudio-connect)',
    data: {
      time: 'time="2023-08-31T17:55:21.770Z',
      bundleId: 39787,
      contentId: '673e277c-0148-42eb-b2a2-d70f8e6b455d',
      server: 'https://rsc.radixu.com',
      source: 'server deployment log',
      taskId: 'p8HpEBKjvRphdVPz',
    },
  },
  {
    type: 'info',
    msg: 'Connect version: 2023.08.0-dev+479',
    data: {
      time: '2023-08-31T17:55:21.770Z',
      bundleId: 39787,
      contentId: '673e277c-0148-42eb-b2a2-d70f8e6b455d',
      server: 'https://rsc.radixu.com',
      source: 'server deployment log',
      taskId: 'p8HpEBKjvRphdVPz',
    },
  },
  {
    type: 'info',
    msg: 'LANG: C.UTF-8',
    data: {
      time: '2023-08-31T17:55:21.770Z',
      bundleId: 39787,
      contentId: '673e277c-0148-42eb-b2a2-d70f8e6b455d',
      server: 'https://rsc.radixu.com',
      source: 'server deployment log',
      taskId: 'p8HpEBKjvRphdVPz',
    },
  },
  {
    type: 'info',
    msg: 'Working directory: /opt/rstudio-connect/mnt/app',
    data: {
      time: '2023-08-31T17:55:21.770Z',
      bundleId: 39787,
      contentId: '673e277c-0148-42eb-b2a2-d70f8e6b455d',
      server: 'https://rsc.radixu.com',
      source: 'server deployment log',
      taskId: 'p8HpEBKjvRphdVPz',
    },
  },
  {
    type: 'event',
    msg: 'Restore Python Environment',
    data: {
      time: '023-08-31T17:55:21.770Z',
    }
  },
  {
    type: 'info',
    msg: 'Building environment using Python 3.9.7 at /opt/python/3.9.7/bin/python3.9',
    data: {
      time: '023-08-31T17:55:21.770Z',
      bundleId: 39787,
      contentId: '673e277c-0148-42eb-b2a2-d70f8e6b455d',
      server: 'https://rsc.radixu.com',
      source: 'server deployment log',
      taskId: 'p8HpEBKjvRphdVPz',
    },
  },
  {
    type: 'info',
    msg: 'Skipped packages: rsconnect-python==1.17.0',
    data: {
      time: '2023-08-31T17:55:21.770Z',
      bundleId: 39787,
      contentId: '673e277c-0148-42eb-b2a2-d70f8e6b455d',
      server: 'https://rsc.radixu.com',
      source: 'server deployment log',
      taskId: 'p8HpEBKjvRphdVPz',
    },
  },
  {
    type: 'info',
    msg: 'Using cached environment: Pa5tKYxKMSNr6xGrmbr8Nw',
    data: {
      time: '2023-08-31T17:55:21.770Z',
      bundleId: 39787,
      contentId: '673e277c-0148-42eb-b2a2-d70f8e6b455d',
      server: 'https://rsc.radixu.com',
      source: 'server deployment log',
      taskId: 'p8HpEBKjvRphdVPz',
    },
  },
  {
    type: 'info',
    msg: 'Packages in the environment: aiofiles==23.2.1, anyio==3.6.2, asgiref==3.6.0, click==8.1.3, fastapi==0.95.2, h11==0.14.0, idna==3.4, pydantic==1.10.7, PyJWT==2.7.0, semver==2.13.0, six==1.16.0, sniffio==1.3.0, starlette==0.27.0, typing_extensions==4.5.0, uvicorn==0.22.0, websockets==11.0.3, ',
    data: {
      time: '2023-08-31T17:55:23.187Z',
      bundleId: 39787,
      contentId: '673e277c-0148-42eb-b2a2-d70f8e6b455d',
      server: 'https://rsc.radixu.com',
      source: 'server deployment log',
      taskId: 'p8HpEBKjvRphdVPz',
    },
  },
  {
    type: 'info',
    msg: 'Creating lockfile: python/requirements.txt.lock',
    data: {
      time: '2023-08-31T17:55:23.187Z',
      bundleId: 39787,
      contentId: '673e277c-0148-42eb-b2a2-d70f8e6b455d',
      server: 'https://rsc.radixu.com',
      source: 'server deployment log',
      taskId: 'p8HpEBKjvRphdVPz',
    },
  },
  {
    type: 'info',
    msg: 'Completed Python build against Python version: 3.9.7',
    data: {
      time: '2023-08-31T17:55:23.894Z',
      bundleId: 39787,
      contentId: '673e277c-0148-42eb-b2a2-d70f8e6b455d',
      server: 'https://rsc.radixu.com',
      source: 'server deployment log',
      taskId: 'p8HpEBKjvRphdVPz',
    },
  },
  {
    type: 'event',
    msg: 'Run Content',
    data: {
      time: '2023-08-31T17:55:23.894Z',
    }
  },
  {
    type: 'info',
    msg: 'Launching FastAPI application...',
    data: {
      time: '2023-08-31T17:55:23.894Z',
      bundleId: 39787,
      contentId: '673e277c-0148-42eb-b2a2-d70f8e6b455d',
      server: 'https://rsc.radixu.com',
      source: 'server deployment log',
      taskId: 'p8HpEBKjvRphdVPz',
    },
  },
  {
    type: 'event',
    msg: 'Set Vanity URL',
    data: {
      time: '2023-08-31T17:55:22.333Z',
    }
  },
  // adding vanity URL path
  {
    type: 'info',
    msg: 'Configuring Vanity URL at /my-project',
    data: {
      time: '2023-08-31T17:55:23.894Z',
      path: 'http://dogfood:3939/my-special-app'
    }
  },
  {
    type: 'event',
    msg: 'Wrapping up Deployment',
    data: {
      time: '2023-08-31T17:55:23.894Z',
    }
  },
  {
    type: 'info',
    msg: 'Deployment successful! Accessible @ https://rsc.radixu.com/connect/my-project',
    data: {
      time: '2023-08-31T17:55:23.894Z',
      contentID: '673e277c-0148-42eb-b2a2-d70f8e6b455d',
      dashboardURL: 'https://rsc.radixu.com/connect/#/apps/673e277c-0148-42eb-b2a2-d70f8e6b455d',
      directURL: 'https://rsc.radixu.com/content/673e277c-0148-42eb-b2a2-d70f8e6b455d',
      serverURL: 'https://rsc.radixu.com',
    },
  },
];

getInitialDeploymentState();
</script>

<style lang="scss" scoped>
.posit-logo {
  max-height: 26px;
  width: auto;
}
</style>
