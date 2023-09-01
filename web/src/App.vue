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
        <WhitePositLogo
          class="posit-logo"
          alt="Posit PBC Logo"
        />
        <div
          style=""
          class="text-white row"
        >
          <q-btn flat @click="menu = !menu" dense icon="menu">
            <q-menu dark>
              <q-list style="min-width: 100px">
                <q-item clickable v-close-popup>
                  <q-item-section>Overview</q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="showDebug = !showDebug">
                  <q-item-section>{{ !showDebug ? "Show Debug Console" : "Hide Debug Console" }} </q-item-section>
                </q-item>
                <q-separator dark/>
                <q-item clickable v-close-popup>
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
        <q-btn icon="close" flat @click="showDebug = false"></q-btn>
      </q-toolbar>
      <q-scroll-area class="fit" >
        <div class="q-pa-sm">
          <div v-for="n in 50" :key="n" dark>{{ debugModel }} log: drawer {{ n }} / 50</div>
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
          indicator-color="primary"
          align="justify"
          narrow-indicator
        >
          <q-tab name="newDeployment" label="New Deployment" dark />
          <q-tab name="updateDeployment" label="Update Existing Deployment" dark />
        </q-tabs>
        <q-separator />

        <q-tab-panels v-model="tab" animated dark>
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
                @publish="onPublish"
              />
              <div class="q-mx-md q-mt-xl q-mb-sm">
                Customize your deployment on the server by expanding any of the sections below.
              </div>
              <q-separator dark class="q-mx-md"/>
              <DestinationTarget />
              <q-separator dark class="q-mx-md" />
              <FilesToPublish />
              <q-separator dark class="q-mx-md" />
              <PythonProject />
              <q-separator dark class="q-mx-md" />
              <CommonSettings />
              <q-separator dark class="q-mx-md" />
              <AdvancedSettings />
              <q-separator dark class="q-mx-md" />
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
                @publish="onPublish"
              />
              <div class="q-mx-md q-mt-xl q-mb-sm">
                Customize your deployment on the server by expanding any of the sections below.
              </div>
              <q-separator dark class="q-mx-md"/>
              <DestinationTarget />
              <q-separator dark class="q-mx-md" />
              <FilesToPublish />
              <q-separator dark class="q-mx-md" />
              <PythonProject />
              <q-separator dark class="q-mx-md" />
              <CommonSettings />
              <q-separator dark class="q-mx-md" />
              <AdvancedSettings />
              <q-separator dark class="q-mx-md" />
            </q-list>
          </q-tab-panel>
        </q-tab-panels>
      </q-page>
      <q-page
        v-if="showPublishing"
        class="max-width-md q-mx-auto"
        padding
      >
        <div class="q-mx-md q-mb-md">
          Your 5 files from project/XYZ are being published to the Dogfood Posit Connect Server
          under the title of 'My special project', using the credentials for 'admin'. This project
          will be run using Python 3.9.5 on the server and will require 15 packages to be installed
          to support it's execution. It will be accessed via the Vanity URL of http://dogfood:3939/my-special-app.
        </div>
        <q-tabs
          v-model="publishingTab"
          dense
          class="text-grey"
          active-color="white"
          indicator-color="primary"
          align="justify"
          narrow-indicator
        >
          <q-tab name="summary" label="Summary View" dark />
          <q-tab name="advanced" label="Advanced View" dark />
        </q-tabs>
        <q-tab-panels v-model="publishingTab" animated dark>
          <q-tab-panel name="summary">
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
                color="blue-grey-5"
                active-color="blue-2"
                done-color="blue-4"
                :done="activeSummaryStep > 1"
              >
                Registering the deployment object with the Posit Connect Server.
              </q-step>
              <q-step
                :name="2"
                title="Create Bundle"
                icon="compress"
                color="blue-grey-5"
                active-color="blue-2"
                done-color="blue-4"
                :done="activeSummaryStep > 2"
              >
                Collecting and bundling up the files included in your project, so that
                they can be uploaded to the server within a bundle.
              </q-step>
              <q-step
                :name="3"
                title="Upload Bundle"
                icon="login"
                color="blue-grey-5"
                active-color="blue-2"
                done-color="blue-4"
                :done="activeSummaryStep > 3"
              >
                Transferring the files from your local workstation to the server.
              </q-step>
              <q-step
                :name="4"
                title="Deploy Bundle"
                icon="publish"
                color="blue-grey-5"
                active-color="blue-2"
                done-color="blue-4"
                :done="activeSummaryStep > 4"
              >
                Associating the uploaded bundle with the deployment object.
              </q-step>
              <q-step
                :name="5"
                title="Restore Python Environment"
                :caption="pythonRestoreStatus"
                icon="move_down"
                color="blue-grey-5"
                active-color="blue-2"
                done-color="blue-4"
                :done="activeSummaryStep > 5"
              >
                Collecting and bundling up the files included in your project, so that
                they can be uploaded to the server within a bundle.
              </q-step>
              <q-step
                :name="6"
                title="Run Content"
                icon="sync"
                color="blue-grey-5"
                active-color="blue-2"
                done-color="blue-4"
                :done="activeSummaryStep > 6"
              >
                Performing execution checks ahead of applying settings.
              </q-step>
              <q-step
                :name="7"
                title="Set Vanity URL"
                icon="settings"
                color="blue-grey-5"
                active-color="blue-2"
                done-color="blue-4"
                :done="activeSummaryStep > 7"
              >
                Configuring the Vanity URL for your content.
              </q-step>
              <q-step
                :name="8"
                title="Wrapping up Deployment"
                caption="Success"
                icon="done_all"
                color="blue-4"
                active-color="blue-4"
                :done="activeSummaryStep >= 8"
              >
                Your project has been successfully deployed to the server and is
                available at https://connect.abc.com/my-project
              </q-step>
            </q-stepper>
            <q-banner v-if="activeSummaryStep === 9" class="bg-purple-8 text-white q-px-lg">
              Your project has been successfully deployed to the server and is
              available at https://connect.abc.com/my-project
            </q-banner>
          </q-tab-panel>
          <q-tab-panel name="advanced">
            <div
              v-for="(log, index)  in advancedLog"
              :key="index"
            >
              <div
                v-if="log.type === 'event'"
                class="bg-primary text-white q-mt-md q-pa-sm"
              >
                <span style="font-weight: bold;">{{ log.msg }}</span>
                <q-icon name="check_circle" class="q-ml-sm" size="sm" color="blue-grey-11"/>
              </div>
              <div
                v-if="log.type === 'info' && index % 2"
                style="background-color: black; color: white"
                class="q-pl-sm q-mt-sm"
              >
                <div class="row">
                  <div class="col-3">
                    {{  log.time }}
                  </div>
                  <!-- <div class="col-1">
                    <q-icon name="info" class="q-ml-md" size="sm" color="blue-grey-11"/>
                  </div> -->
                  <div class="col-8">
                    {{ log.msg }}
                  </div>
                </div>
              </div>
              <div
                v-if="log.type === 'info' && !(index % 2)"
                style="background-color: black; color: white"
                class="q-pl-sm q-mt-sm"
              >
                <div class="row">
                  <div class="col-3">
                    {{ log.time }}
                  </div>
                  <!-- <div class="col-1">
                    <q-icon name="info" class="q-ml-md" size="sm" color="blue-grey-11" />
                  </div> -->
                  <div class="col-8">
                    {{ log.msg }}
                  </div>
                </div>
              </div>
            </div>
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
import WhitePositLogo from 'src/components/icons/WhitePositLogo.vue';

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

const windowWidth = ref(window.innerWidth);
const windowHeight = ref(window.innerHeight);

const handleResize = () => {
  windowWidth.value = window.innerWidth;
  windowHeight.value = window.innerHeight;
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

  const interval = setInterval(() => {
    if (activeSummaryStep.value === 5) {
      pythonRestoreStatus.value = getNextPublishStatus();
      if (pythonRestoreStatus.value === '') {
        activeSummaryStep.value += 1;
      }
    } else if (activeSummaryStep.value === 9) {
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

type LogEntry = {
  type: 'event' | 'info' | 'error',
  msg: string,
  time: string,
}

const advancedLog:LogEntry[] = [
  {
    type: 'event',
    msg: 'Create Deployment',
    time: '2023-08-31T17:55:19.777Z',
  },
  {
    type: 'info',
    time: '2023-08-31T17:55:19.777Z',
    msg: 'Loading rsconnect accounts from /Users/billsager/Library/Preferences/org.R-project.R/R/rsconnect"',
  },
  {
    type: 'info',
    time: '2023-08-31T17:55:19.792Z',
    msg: 'Loading rsconnect-python accounts from /Users/billsager/Library/Application Support/rsconnect-python/servers.json"',
  },
  {
    type: 'event',
    time: '2023-08-31T17:55:19.794Z',
    msg: 'Create Bundle',
  },
  {
    type: 'info',
    time: '2023-08-31T17:55:19.794Z',
    msg: 'Creating bundle from directory" source_dir=/Users/billsager/dev/publishing-client/test/sample-content/fastapi-simple',
  },
  {
    type: 'info',
    time: '2023-08-31T17:55:19.794Z',
    msg: 'Adding file" path=/Users/billsager/dev/publishing-client/test/sample-content/fastapi-simple/requirements.txt size=235',
  },
  {
    type: 'info',
    time: '2023-08-31T17:55:19.796Z',
    msg: 'Adding file" path=/Users/billsager/dev/publishing-client/test/sample-content/fastapi-simple/simple.py size=369',
  },
  {
    type: 'info',
    time: '2023-08-31T17:55:19.796Z',
    msg: 'Adding file" path=/Users/billsager/dev/publishing-client/test/sample-content/fastapi-simple/meta.yaml size=63',
  },
  {
    type: 'info',
    time: '2023-08-31T17:55:19.797Z',
    msg: 'Adding file" path=/Users/billsager/dev/publishing-client/test/sample-content/fastapi-simple/requirements.in size=124',
  },
  {
    type: 'info',
    time: '2023-08-31T17:55:19.797Z',
    msg: 'Bundle created" files=4 total_bytes=791',
  },
  {
    type: 'event',
    time: '2023-08-31T17:55:19.797Z',
    msg: 'Upload Bundle',
  },
  {
    type: 'info',
    time: '2023-08-31T17:55:19.797Z',
    msg: 'Uploading Bundle to server."',
  },
  {
    type: 'event',
    time: '2023-08-31T17:55:21.066Z',
    msg: 'Deploy Bundle',
  },
  {
    type: 'info',
    time: '2023-08-31T17:55:21.066Z',
    msg: 'Building FastAPI application..." bundle_id=39787 content_id=673e277c-0148-42eb-b2a2-d70f8e6b455d server="https://rsc.radixu.com" source="server deployment log" task_id=p8HpEBKjvRphdVPz',
  },
  {
    type: 'info',
    time: '2023-08-31T17:55:21.066Z',
    msg: 'Bundle created with Python version 3.9.10 is compatible with environment Local with Python version 3.9.7 from /opt/python/3.9.7/bin/python3.9 " bundle_id=39787 content_id=673e277c-0148-42eb-b2a2-d70f8e6b455d server="https://rsc.radixu.com" source="server deployment log" task_id=p8HpEBKjvRphdVPz',
  },
  {
    type: 'info',
    time: '2023-08-31T17:55:21.066Z',
    msg: 'Bundle requested Python version 3.9.10; using /opt/python/3.9.7/bin/python3.9 which has version 3.9.7" bundle_id=39787 content_id=673e277c-0148-42eb-b2a2-d70f8e6b455d server="https://rsc.radixu.com" source="server deployment log" task_id=p8HpEBKjvRphdVPz',
  },
  {
    type: 'info',
    time: '2023-08-31T17:55:21.066Z',
    msg: '2023/08/31 17:55:20.960662287 [rsc-session] Content GUID: 673e277c-0148-42eb-b2a2-d70f8e6b455d" bundle_id=39787 content_id=673e277c-0148-42eb-b2a2-d70f8e6b455d server="https://rsc.radixu.com" source="server deployment log" task_id=p8HpEBKjvRphdVPz',
  },
  {
    type: 'info',
    time: '2023-08-31T17:55:21.066Z',
    msg: '2023/08/31 17:55:20.960713291 [rsc-session] Content ID: 23719" bundle_id=39787 content_id=673e277c-0148-42eb-b2a2-d70f8e6b455d server="https://rsc.radixu.com" source="server deployment log" task_id=p8HpEBKjvRphdVPz',
  },
  {
    type: 'info',
    time: '2023-08-31T17:55:21.066Z',
    msg: '2023/08/31 17:55:20.960719742 [rsc-session] Bundle ID: 39787" bundle_id=39787 content_id=673e277c-0148-42eb-b2a2-d70f8e6b455d server="https://rsc.radixu.com" source="server deployment log" task_id=p8HpEBKjvRphdVPz',
  },
  {
    type: 'info',
    time: '2023-08-31T17:55:21.066Z',
    msg: '2023/08/31 17:55:20.960724946 [rsc-session] Job Key: n8E1fjfUwdkfbQIT" bundle_id=39787 content_id=673e277c-0148-42eb-b2a2-d70f8e6b455d server="https://rsc.radixu.com" source="server deployment log" task_id=p8HpEBKjvRphdVPz',
  },
  {
    type: 'info',
    time: '2023-08-31T17:55:21.769Z',
    msg: '2023/08/31 17:55:21.248013719 Running on host: dogfood01" bundle_id=39787 content_id=673e277c-0148-42eb-b2a2-d70f8e6b455d server="https://rsc.radixu.com" source="server deployment log" task_id=p8HpEBKjvRphdVPz',
  },
  {
    type: 'info',
    time: '2023-08-31T17:55:21.769Z',
    msg: '2023/08/31 17:55:21.267666479 Linux distribution: Ubuntu 22.04.2 LTS (jammy)" bundle_id=39787 content_id=673e277c-0148-42eb-b2a2-d70f8e6b455d server="https://rsc.radixu.com" source="server deployment log" task_id=p8HpEBKjvRphdVPz',
  },
  {
    type: 'info',
    time: 'time="2023-08-31T17:55:21.770Z',
    msg: '2023/08/31 17:55:21.272035496 Running as user: uid=1031(rstudio-connect) gid=999(rstudio-connect) groups=999(rstudio-connect)" bundle_id=39787 content_id=673e277c-0148-42eb-b2a2-d70f8e6b455d server="https://rsc.radixu.com" source="server deployment log" task_id=p8HpEBKjvRphdVPz',
  },
  {
    type: 'info',
    time: '2023-08-31T17:55:21.770Z',
    msg: '2023/08/31 17:55:21.272051741 Connect version: 2023.08.0-dev+479" bundle_id=39787 content_id=673e277c-0148-42eb-b2a2-d70f8e6b455d server="https://rsc.radixu.com" source="server deployment log" task_id=p8HpEBKjvRphdVPz',
  },
  {
    type: 'info',
    time: '2023-08-31T17:55:21.770Z',
    msg: '2023/08/31 17:55:21.272091262 LANG: C.UTF-8" bundle_id=39787 content_id=673e277c-0148-42eb-b2a2-d70f8e6b455d server="https://rsc.radixu.com" source="server deployment log" task_id=p8HpEBKjvRphdVPz',
  },
  {
    type: 'info',
    time: '2023-08-31T17:55:21.770Z',
    msg: '2023/08/31 17:55:21.272093019 Working directory: /opt/rstudio-connect/mnt/app" bundle_id=39787 content_id=673e277c-0148-42eb-b2a2-d70f8e6b455d server="https://rsc.radixu.com" source="server deployment log" task_id=p8HpEBKjvRphdVPz',
  },
  {
    type: 'event',
    time: '023-08-31T17:55:21.770Z',
    msg: 'Restore Python Environment',
  },
  {
    type: 'info',
    time: '023-08-31T17:55:21.770Z',
    msg: '2023/08/31 17:55:21.272375532 Building environment using Python 3.9.7 (default, Jun  4 2023, 23:06:07) [GCC 11.3.0] at /opt/python/3.9.7/bin/python3.9" bundle_id=39787 content_id=673e277c-0148-42eb-b2a2-d70f8e6b455d server="https://rsc.radixu.com" source="server deployment log" task_id=p8HpEBKjvRphdVPz',
  },
  {
    type: 'info',
    time: '2023-08-31T17:55:21.770Z',
    msg: '2023/08/31 17:55:21.286205142 Skipped packages: rsconnect-python==1.17.0" bundle_id=39787 content_id=673e277c-0148-42eb-b2a2-d70f8e6b455d server="https://rsc.radixu.com" source="server deployment log" task_id=p8HpEBKjvRphdVPz',
  },
  {
    type: 'info',
    time: '2023-08-31T17:55:21.770Z',
    msg: '2023/08/31 17:55:21.286216872 Using cached environment: Pa5tKYxKMSNr6xGrmbr8Nw" bundle_id=39787 content_id=673e277c-0148-42eb-b2a2-d70f8e6b455d server="https://rsc.radixu.com" source="server deployment log" task_id=p8HpEBKjvRphdVPz',
  },
  {
    type: 'info',
    time: '2023-08-31T17:55:23.187Z',
    msg: '2023/08/31 17:55:22.999380579 Packages in the environment: aiofiles==23.2.1, anyio==3.6.2, asgiref==3.6.0, click==8.1.3, fastapi==0.95.2, h11==0.14.0, idna==3.4, pydantic==1.10.7, PyJWT==2.7.0, semver==2.13.0, six==1.16.0, sniffio==1.3.0, starlette==0.27.0, typing_extensions==4.5.0, uvicorn==0.22.0, websockets==11.0.3, " bundle_id=39787 content_id=673e277c-0148-42eb-b2a2-d70f8e6b455d server="https://rsc.radixu.com" source="server deployment log" task_id=p8HpEBKjvRphdVPz',
  },
  {
    type: 'info',
    time: '2023-08-31T17:55:23.187Z',
    msg: '2023/08/31 17:55:23.002230924 Creating lockfile: python/requirements.txt.lock" bundle_id=39787 content_id=673e277c-0148-42eb-b2a2-d70f8e6b455d server="https://rsc.radixu.com" source="server deployment log" task_id=p8HpEBKjvRphdVPz',
  },
  {
    type: 'info',
    time: '2023-08-31T17:55:23.894Z',
    msg: 'Completed Python build against Python version: 3.9.7" bundle_id=39787 content_id=673e277c-0148-42eb-b2a2-d70f8e6b455d server="https://rsc.radixu.com" source="server deployment log" task_id=p8HpEBKjvRphdVPz',
  },
  {
    type: 'event',
    time: '2023-08-31T17:55:23.894Z',
    msg: 'Run Content',
  },
  {
    type: 'info',
    time: '2023-08-31T17:55:23.894Z',
    msg: 'Launching FastAPI application..." bundle_id=39787 content_id=673e277c-0148-42eb-b2a2-d70f8e6b455d server="https://rsc.radixu.com" source="server deployment log" task_id=p8HpEBKjvRphdVPz',
  },
  {
    type: 'event',
    time: '2023-08-31T17:55:22.333Z',
    msg: 'Set Vanity URL',
  },
  {
    type: 'info',
    time: '2023-08-31T17:55:23.894Z',
    msg: 'Configuring Vanity URL at /my-project',
  },
  {
    type: 'event',
    time: '2023-08-31T17:55:23.894Z',
    msg: 'Wrapping up Deployment',
  },
  {
    type: 'info',
    time: '2023-08-31T17:55:23.894Z',
    msg: 'Deployment successful! contentID=673e277c-0148-42eb-b2a2-d70f8e6b455d dashboardURL="https://rsc.radixu.com/connect/#/apps/673e277c-0148-42eb-b2a2-d70f8e6b455d" directURL="https://rsc.radixu.com/content/673e277c-0148-42eb-b2a2-d70f8e6b455d" serverURL="https://rsc.radixu.com"',
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
