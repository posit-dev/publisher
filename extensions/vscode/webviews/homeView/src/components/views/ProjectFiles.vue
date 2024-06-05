<template>
  <TreeSection
    title="Project Files"
    :actions="[
      {
        label: 'Refresh Project Files',
        codicon: 'codicon-refresh',
        fn: () =>
          sendMsg({ kind: WebviewToHostMessageType.REQUEST_FILES_LISTS }),
      },
    ]"
  >
    <TreeItem
      v-model:expanded="includedExpanded"
      title="Included Files"
      codicon="codicon-list-unordered"
    >
      <template #default="{ indentLevel }">
        <TreeItem
          v-for="file in home.includedFiles"
          @click="
            sendMsg({
              kind: WebviewToHostMessageType.VSCODE_OPEN_RELATIVE,
              content: { relativePath: file.id },
            })
          "
          :key="file.id"
          :title="file.base"
          :description="fileDescription(file)"
          codicon="codicon-debug-stackframe-dot"
          :tooltip="includedFileTooltip(file)"
          :indentLevel="indentLevel"
          :actions="[
            {
              label: 'Exclude this file',
              codicon: 'codicon-diff-removed',
              fn: () =>
                sendMsg({
                  kind: WebviewToHostMessageType.EXCLUDE_FILE,
                  content: { path: file.id },
                }),
            },
          ]"
        >
          <template #postDecor v-if="!lastDeployedFiles.has(file.rel)">
            <PostDecor class="text-git-added">A</PostDecor>
          </template>
        </TreeItem>
      </template>
    </TreeItem>

    <TreeItem
      v-model:expanded="excludedExpanded"
      title="Excluded Files"
      codicon="codicon-list-unordered"
    >
      <template #default="{ indentLevel }">
        <TreeItem
          v-for="file in home.excludedFiles"
          @click="
            sendMsg({
              kind: WebviewToHostMessageType.VSCODE_OPEN_RELATIVE,
              content: { relativePath: file.id },
            })
          "
          :key="file.id"
          :title="file.base"
          :description="fileDescription(file)"
          codicon="codicon-debug-stackframe-dot"
          :tooltip="excludedFileTooltip(file)"
          :indentLevel="indentLevel"
          :actions="
            file.reason?.source === FileMatchSource.BUILT_IN
              ? undefined
              : [
                  {
                    label: 'Include this file',
                    codicon: 'codicon-diff-added',
                    fn: () =>
                      sendMsg({
                        kind: WebviewToHostMessageType.INCLUDE_FILE,
                        content: { path: file.id },
                      }),
                  },
                ]
          "
        />
      </template>
    </TreeItem>
  </TreeSection>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import {
  ContentRecordFile,
  ContentRecordState,
  FileMatchSource,
} from "../../../../../src/api";
import { WebviewToHostMessageType } from "../../../../../src/types/messages/webviewToHostMessages";

import TreeItem from "src/components/TreeItem.vue";
import TreeSection from "src/components/TreeSection.vue";
import { useHomeStore } from "src/stores/home";
import { useHostConduitService } from "src/HostConduitService";

const home = useHomeStore();
const { sendMsg } = useHostConduitService();

const includedExpanded = ref(false);
const excludedExpanded = ref(false);

const lastDeployedFiles = computed(() => {
  if (home.selectedContentRecord?.state === ContentRecordState.NEW) {
    return new Set();
  }

  return new Set(home.selectedContentRecord?.files);
});

const fileDescription = (file: ContentRecordFile) => {
  if (file.relDir === ".") {
    return undefined;
  }
  return file.relDir;
};

const includedFileTooltip = (file: ContentRecordFile) => {
  let tooltip = `${file.rel} will be included in the next deployment.`;
  if (file.reason) {
    tooltip += `\nThe configuration file ${file.reason?.fileName} is including it with the pattern '${file.reason?.pattern}'`;
  }
  return tooltip;
};

const excludedFileTooltip = (file: ContentRecordFile) => {
  let tooltip = `${file.rel} will be excluded in the next deployment.`;
  if (file.reason) {
    if (file.reason.source === FileMatchSource.BUILT_IN) {
      tooltip += `\nThis is a built-in exclusion for the pattern: '${file.reason.pattern}' and cannot be overridden.`;
    } else {
      tooltip += `\nThe configuration file ${file.reason?.fileName} is excluding it with the pattern '${file.reason?.pattern}'`;
    }
  } else {
    tooltip += `\nIt did not match any pattern in the configuration 'files' list.`;
  }
  return tooltip;
};
</script>
