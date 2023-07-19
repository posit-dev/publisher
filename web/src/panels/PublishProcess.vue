<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-linear-progress
    v-if="showProgressBar"
    stripe
    rounded
    size="20px"
    :value="progressValue"
    color="primary"
    class="q-mt-sm"
  />
  <div class="q-mt-sm fit row wrap justify-end items-start content-start">
    <q-btn
      v-if="showDetailsButton"
      class="q-mt-sm q-ml-sm"
      color="primary"
      label="Details..."
      @click="toggleShowTimeline"
    />
    <q-btn
      :disabled="disablePublishButton"
      class="q-mt-sm q-ml-sm"
      color="primary"
      label="Publish"
      @click="onClickPublish"
    />
  </div>
  <q-timeline
    v-if="showTimeline"
    color="secondary"
    class="text-body3"
  >
    <q-timeline-entry
      heading
      class="text-body2"
      style="font-size: 0.75rem !important;"
    >
      Deployment Timeline
    </q-timeline-entry>

    <q-timeline-entry
      v-for="step in deploymentSteps"
      :key="step.type"
      :title="step.type"
      side="left"
      class="text-body2"
      avatar="https://cdn.quasar.dev/logo-v2/svg/logo.svg"
    >
      <q-expansion-item>
        <template #header>
          <q-item-section>
            <q-item-label>Success - {{ step.log.length }} lines</q-item-label>
          </q-item-section>
        </template>
        <div class="terminal-container">
          <div
            v-for="row, ndx in step.log"
            :key="ndx"
            class="terminal"
          >
            {{ row }}
          </div>
        </div>
      </q-expansion-item>
    </q-timeline-entry>
  </q-timeline>
</template>

<script setup lang="ts">

import { ref } from 'vue';

import { deploymentSteps } from './deploymentSteps';

const showDetailsButton = ref(false);
const showTimeline = ref(false);
const showProgressBar = ref(false);
const disablePublishButton = ref(false);
const progressValue = ref(0);

function toggleShowDetailsButton() {
  showDetailsButton.value = !showDetailsButton.value;
}

function toggleShowProgressBar() {
  showProgressBar.value = !showProgressBar.value;

  if (showProgressBar.value) {
    progressValue.value = 0;
    const interval = setInterval(() => {
      progressValue.value += 0.1;
      console.log(progressValue.value);
      if (progressValue.value > 1) {
        progressValue.value = 1;
        clearInterval(interval);
      }
    });
  }
}

function toggleShowTimeline() {
  showTimeline.value = !showTimeline.value;
}

function onClickPublish() {
  toggleShowProgressBar();
  toggleShowDetailsButton();
}

</script>

<style>
.q-timeline__heading-title {
  font-size: 1rem;
  padding: unset;
}
.q-timeline__title {
  font-size: 1rem;
  margin-bottom: 8px;
}
.terminal-container {
  margin-left: 1rem;
  padding: 1rem;
  background-color: darkgray;
  color: black;
}
.terminal {
  max-width: 100%;
  font-size: 0.75rem;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}
</style>
