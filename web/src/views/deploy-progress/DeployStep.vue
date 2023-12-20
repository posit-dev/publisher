<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-step
    :name="name"
    title="This is a step"
    :icon="icon"
    :active-icon="hasError ? 'warning' : icon"
    :active-color="hasError ? 'red' : undefined"
    :header-nav="true"
    :error="hasError"
    error-icon="warning"
    error-color="red"
  >
    <div
      class="text-bold q-pa-sm summaryClass"
    >
      {{ summary }}
    </div>
    <q-list
      dense
      class="logClass"
    >
      <q-item
        v-for="(msg, index) in messages"
        :key="index"
      >
        <q-item-section>
          <!-- {{ JSON.stringify(msg) }} -->
          <template v-if="isErrorEventStreamMessage(msg)">
            <span class="text-error text-weight-medium">
              {{ formatMsg(msg) }}<br>
            </span>
            <ul>
              <li
                v-for="(nameValue, i) in splitErrorLog(msg)"
                :key="i"
                class="text-caption q-ml-md"
              >
                <span class="text-weight-medium">
                  {{ nameValue.name }}:
                </span>
                <span>
                  {{ nameValue.value }}<br>
                </span>
              </li>
            </ul>
          </template>
          <template v-else>
            <template v-if="msg.type.endsWith('/start')">
              <span class="text-weight-medium  text-caption">
                {{ formatMsg(msg) }}
              </span>
            </template>
            <template v-if="msg.type.endsWith('/success')">
              <span class="text-caption">
                {{ formatMsg(msg) }}
              </span>
            </template>
            <template v-if="msg.type.endsWith('/status')">
              <span class="text-weight-medium text-caption">
                {{ formatMsg(msg) }}
              </span>
            </template>
            <template v-if="msg.type.endsWith('/log')">
              <span class="text-caption">
                {{ formatMsg(msg) }}
              </span>
            </template>
            <template v-if="msg.type.endsWith('/progress')">
              <span class="text-caption">
                {{ formatMsg(msg) }}
              </span>
            </template>
          </template>
        </q-item-section>
      </q-item>
    </q-list>
  </q-step>
</template>

<script setup lang="ts">
import { PropType, computed } from 'vue';
import {
  EventStreamMessage,
  isErrorEventStreamMessage,
  isPublishCreateBundleLog,
  isPublishCreateBundleSuccess,
  isPublishCreateDeploymentStart,
  isPublishCreateDeploymentSuccess,
  isPublishCreateNewDeploymentStart,
  isPublishCreateNewDeploymentSuccess,
  isPublishDeployBundleSuccess,
  isPublishRestorePythonEnvLog,
  isPublishRestorePythonEnvStart,
  isPublishRestorePythonEnvStatus,
  isPublishRunContentLog,
  isPublishSetVanityURLLog,
  isPublishValidateDeploymentLog
} from 'src/api/types/events';

const props = defineProps({
  name: { type: [String, Number], required: true },
  icon: { type: String, required: true },
  summary: { type: String, required: true },
  messages: { type: Array as PropType<EventStreamMessage[]>, required: false, default: () => [] },
});

const hasError = computed(() => props.messages.some(msg => isErrorEventStreamMessage(msg)));

const formatMsg = (msg: EventStreamMessage): string => {
  if (isPublishCreateNewDeploymentStart(msg) || isPublishCreateNewDeploymentSuccess(msg)) {
    if (msg.data.contentId) {
      return `${msg.data.message} ${msg.data.saveName}, ContentID: ${msg.data.contentId}`;
    }
    return `${msg.data.message} ${msg.data.saveName}`;
  } else if (isPublishCreateBundleSuccess(msg)) {
    return `${msg.data.message} ${msg.data.filename}`;
  } else if (isPublishCreateDeploymentStart(msg) || isPublishCreateDeploymentSuccess(msg)) {
    return `${msg.data.message} ${msg.data.saveName}`;
  } else if (isPublishDeployBundleSuccess(msg)) {
    return `${msg.data.message}, TaskID: ${msg.data.taskId}`;
  } else if (isPublishRestorePythonEnvStart(msg)) {
    return `${msg.data.message}, Source: ${msg.data.source}`;
  } else if (isPublishCreateBundleLog(msg)) {
    if (msg.data.sourceDir) {
      return `${msg.data.message} ${msg.data.sourceDir}`;
    } else if (msg.data.totalBytes) {
      return `${msg.data.message} ${msg.data.files} files, ${msg.data.totalBytes} bytes`;
    }
    return `${msg.data.message} ${msg.data.path} (${msg.data.size} bytes)`;
  } else if (isPublishRestorePythonEnvLog(msg)) {
    return `${msg.data.message}`;
  } else if (
    isPublishRunContentLog(msg) ||
    isPublishSetVanityURLLog(msg) ||
    isPublishValidateDeploymentLog(msg)
  ) {
    return `${msg.data.message} ${msg.data.path}`;
  } else if (isPublishRestorePythonEnvStatus(msg)) {
    return `${msg.data.message} ${msg.data.name} (${msg.data.version})`;
  } else if (isErrorEventStreamMessage(msg)) {
    return `${msg.data.error}`;
  }
  return msg.data.message;
};

type NameValue = {
  name: string,
  value: string,
};

const splitErrorLog = (msg: EventStreamMessage) => {
//   {
//     "time": "2023-12-19T14:53:23.611707-08:00",
//     "type": "publish/uploadBundle/failure",
//     "data": {
//         "level": "ERROR",
//         "message": "unexpected response from the server",
//         "method": "POST",
//         "status": 403,
//         "url": "https://connect.localtest.me/rsc/dev-password/__api__/v1/content/20b5a116-a8f8-4213-b4c4-9eef29bc308c/bundles",
//         "code": 21,
//         "error": "You don't have permission to change this item.",
//         "localId": "0EM40IJmUrzfM277",
//         "payload": null
//     },
//     "error": "permissionErr"
// }
  const nameValues: NameValue[] = [];
  Object.keys(msg).forEach(key => {
    if (key !== 'data' && msg[key] !== null) {
      nameValues.push({
        name: key,
        value: msg[key],
      });
    }
  });
  Object.keys(msg.data).forEach(key => {
    nameValues.push({
      name: `data.${key}`,
      value: msg.data[key],
    });
  });
  return nameValues;
};

</script>

<style scoped>

</style>
