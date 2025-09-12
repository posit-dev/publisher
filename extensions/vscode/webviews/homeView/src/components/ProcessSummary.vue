<!-- Copyright (C) 2025 by Posit Software, PBC. -->

<script setup lang="ts">
import { computed } from "vue";
import { ServerType, isPreContentRecord } from "../../../../src/api";
import {
  getProductType,
  isConnectProduct,
} from "../../../../src/utils/multiStepHelpers";
import { ErrorMessageSplitOptions } from "../../../../src/utils/errorEnhancer";
import { useHomeStore } from "src/stores/home";
import { formatDateString } from "src/utils/date";
import TextStringWithAnchor from "./TextStringWithAnchor.vue";

const emit = defineEmits<{
  associateDeployment: [];
  viewContent: [];
  errorLinkClick: [splitOptionId: number];
}>();

const home = useHomeStore();

const isDismissedContentRecord = computed(() => {
  return Boolean(home.selectedContentRecord?.dismissedAt);
});

const isPreContentRecordWithID = computed(() => {
  return (
    isPreContentRecord(home.selectedContentRecord) &&
    Boolean(home.selectedContentRecord.id)
  );
});

const isPreContentRecordWithoutID = computed(() => {
  return (
    isPreContentRecord(home.selectedContentRecord) &&
    !isPreContentRecordWithID.value
  );
});

const isConnectPreContentRecord = computed(() => {
  const serverType =
    home.selectedContentRecord?.serverType || ServerType.CONNECT;
  const productType = getProductType(serverType);
  return isConnectProduct(productType);
});

const lastStatusDescription = computed(() => {
  if (home.contentRenderError) {
    return "Content Render Failed";
  }
  if (home.contentRenderFinished) {
    return "Content Render Finished";
  }
  if (!home.selectedContentRecord) {
    return undefined;
  }
  if (isDismissedContentRecord.value) {
    return "Last Deployment Dismissed";
  }
  if (home.selectedContentRecord.deploymentError) {
    return "Last Deployment Failed";
  }
  if (isPreContentRecord(home.selectedContentRecord)) {
    return isPreContentRecordWithID.value
      ? "Not Yet Updated"
      : "Not Yet Deployed";
  }
  return "Last Deployment Successful";
});

const successfulRenderMsg = computed(() => {
  // We currently only render content with Quarto
  // but if we get to a point of rendering with Rmd or by other means
  // Here is a good place to identify the "source" and use an appropriate label
  return "Successfully rendered with Quarto";
});

const contextMenuVSCodeContext = computed((): string => {
  return home.publishInProgress ||
    isPreContentRecord(home.selectedContentRecord)
    ? "homeview-active-contentRecord-more-menu"
    : "homeview-last-contentRecord-more-menu";
});
</script>

<template>
  <div class="last-action-summary" data-automation="deploy-status">
    <h4 class="last-action-summary__title">
      {{ lastStatusDescription }}
    </h4>
    <ActionToolbar
      v-if="!home.contentRenderFinished"
      title="Logs"
      :actions="[]"
      :context-menu="contextMenuVSCodeContext"
    />
  </div>
  <template v-if="home.contentRenderFinished">
    <div>
      {{ successfulRenderMsg }}
    </div>
  </template>
  <template v-else-if="home.contentRenderError">
    <div class="last-action-summary__error">
      <div class="alert-border border-warning text-warning">
        <span class="codicon codicon-alert" />
      </div>
      <div>
        {{ home.contentRenderError }}
      </div>
    </div>
  </template>
  <template v-else-if="home.selectedContentRecord && isDismissedContentRecord">
    <div class="date-time">
      {{ formatDateString(home.selectedContentRecord.dismissedAt) }}
    </div>
  </template>
  <template v-else>
    <div v-if="isPreContentRecordWithoutID">
      Is this already deployed to a server? You can
      <a class="webview-link" role="button" @click="emit('associateDeployment')"
        >update that previous deployment</a
      >.
    </div>
    <div v-if="isPreContentRecordWithID">
      <a class="webview-link" role="button" @click="emit('viewContent')"
        >This deployment</a
      >
      will be updated when deployed.
    </div>
    <div
      v-if="
        home.selectedContentRecord &&
        !isPreContentRecord(home.selectedContentRecord)
      "
      class="date-time"
    >
      {{ formatDateString(home.selectedContentRecord.deployedAt) }}
    </div>
    <div
      v-if="home.selectedContentRecord?.deploymentError"
      class="last-action-summary__error"
    >
      <div class="alert-border border-warning text-warning">
        <span class="codicon codicon-alert" />
      </div>
      <TextStringWithAnchor
        :message="home.selectedContentRecord?.deploymentError?.msg"
        :splitOptions="ErrorMessageSplitOptions"
        class="last-action-summary__error-anchor text-description"
        @click="emit('errorLinkClick', $event)"
      />
    </div>
  </template>
</template>

<style lang="scss" scoped>
.last-action-summary {
  display: flex;
  justify-content: space-between;
  align-items: baseline;

  &__title {
    margin-block-start: 1.33em;
    margin-bottom: 5px;
  }

  &__error {
    display: flex;
    align-items: stretch;
    margin-top: 10px;

    .alert-border {
      display: flex;
      align-items: center;
      border-right-width: 1px;
      border-right-style: solid;
      padding-right: 5px;
      margin-right: 7px;
    }

    &-anchor {
      min-width: 0;
      word-wrap: break-word;
    }
  }
}

.date-time {
  margin-bottom: 20px;
}
</style>
