<template>
  <TreeSection
    title="Project Files"
    :actions="[
      {
        label: 'Refresh Project Files',
        codicon: 'codicon-refresh',
        fn: () => {},
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
              kind: WebviewToHostMessageType.VSCODE_OPEN,
              content: { uri: file.abs },
            })
          "
          :key="file.id"
          :title="file.base"
          codicon="codicon-debug-stackframe-dot"
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
        />
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
              kind: WebviewToHostMessageType.VSCODE_OPEN,
              content: { uri: file.abs },
            })
          "
          :key="file.id"
          :title="file.base"
          codicon="codicon-debug-stackframe-dot"
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
import { ref } from "vue";

import { FileMatchSource } from "../../../../../src/api";
import { WebviewToHostMessageType } from "../../../../../src/types/messages/webviewToHostMessages";

import TreeItem from "src/components/TreeItem.vue";
import TreeSection from "src/components/TreeSection.vue";
import { useHomeStore } from "src/stores/home";
import { useHostConduitService } from "src/HostConduitService";

const home = useHomeStore();
const { sendMsg } = useHostConduitService();

const includedExpanded = ref(true);
const excludedExpanded = ref(true);
</script>
