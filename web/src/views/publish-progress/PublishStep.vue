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
              {{ formatMsg(msg) }}
            </span>
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
import { EventStreamMessage, isErrorEventStreamMessage, isPublishCreateBundleLog, isPublishCreateBundleSuccess, isPublishCreateDeploymentStart, isPublishCreateDeploymentSuccess, isPublishCreateNewDeploymentStart, isPublishCreateNewDeploymentSuccess, isPublishDeployBundleSuccess, isPublishRestorePythonEnvLog, isPublishRestorePythonEnvStart, isPublishRestorePythonEnvStatus, isPublishRunContentLog, isPublishSetVanityURLLog, isPublishUploadBundleSuccess, isPublishValidateDeploymentLog } from 'src/api/types/events';

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
  }
  return msg.data.message;
};

</script>

<style scoped>

</style>
