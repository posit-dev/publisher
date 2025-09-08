<!-- Copyright (C) 2025 by Posit Software, PBC. -->

<script setup lang="ts">
import { computed } from "vue";
import { isPreContentRecord } from "../../../../src/api";
import { useHomeStore } from "src/stores/home";

const emit = defineEmits<{
  viewLog: [];
}>();

const home = useHomeStore();

const processProgressLabel = computed(() => {
  if (home.publishInProgress) {
    return "Deployment in Progress...";
  }
  if (home.contentRenderInProgress) {
    return "Rendering Content...";
  }
  return "";
});

const renderInProgressMsg = computed(() => {
  // We currently only render content with Quarto
  // but if we get to a point of rendering with Rmd or by other means
  // Here is a good place to identify the "source" and use an appropriate label
  return "Quarto is running to output your content";
});

const contextMenuVSCodeContext = computed((): string => {
  return home.publishInProgress ||
    isPreContentRecord(home.selectedContentRecord)
    ? "homeview-active-contentRecord-more-menu"
    : "homeview-last-contentRecord-more-menu";
});
</script>

<template>
  <div class="process-in-progress">
    <vscode-progress-ring class="process-in-progress__ring" />
    <div class="flex-grow">
      <div class="process-in-progress__title-block">
        <h4
          class="process-in-progress__title"
          data-automation="deployment-progress"
        >
          {{ processProgressLabel }}
        </h4>
        <ActionToolbar
          v-if="home.publishInProgress"
          title="Logs"
          :actions="[]"
          :context-menu="contextMenuVSCodeContext"
        />
      </div>
      <p v-if="home.publishInProgress" class="process-in-progress__log-anchor">
        <a class="webview-link" role="button" @click="emit('viewLog')">
          View Publishing Log
        </a>
      </p>
      <p
        v-if="home.contentRenderInProgress"
        class="process-in-progress__render-msg"
      >
        {{ renderInProgressMsg }}
      </p>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.process-in-progress {
  display: flex;

  &__ring {
    flex-grow: 0;
    margin-top: 1.33em;
    margin-right: 10px;
  }

  &__title-block {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  &__title {
    margin-block-start: 1.33em;
    margin-bottom: 5px;
  }

  &__log-anchor,
  &__render-msg {
    margin-top: 0;
    margin-bottom: 0;
  }
}
</style>
