<template>
  <TreeItem
    v-for="file in props.files"
    :key="file.id"
    :title="file.base"
    :tooltip="
      file.reason?.exclude
        ? excludedFileTooltip(file)
        : includedFileTooltip(file)
    "
    :indentLevel="indentLevel"
    :actions="fileActions(file)"
    v-on="{
      click: file.isFile ? () => openFile(file) : undefined,
    }"
  >
    <template v-if="file.files.length" #default="{ indentLevel }">
      <TreeProjectFiles :files="file.files" :indentLevel="indentLevel" />
    </template>
  </TreeItem>
</template>

<script setup lang="ts">
import TreeItem from "src/components/TreeItem.vue";
import {
  includedFileTooltip,
  excludedFileTooltip,
} from "src/components/views/projectFiles/tooltips";
import TreeProjectFiles from "src/components/views/projectFiles/TreeProjectFiles.vue";
import { useHostConduitService } from "src/HostConduitService";
import { ActionButton } from "src/components/ActionToolbar.vue";

import { ContentRecordFile, FileMatchSource } from "../../../../../../src/api";
import { WebviewToHostMessageType } from "../../../../../../src/types/messages/webviewToHostMessages";

interface Props {
  files: ContentRecordFile[];
  indentLevel?: number;
}

const props = withDefaults(defineProps<Props>(), {
  indentLevel: 1,
});

const { sendMsg } = useHostConduitService();

const openFile = (file: ContentRecordFile) => {
  sendMsg({
    kind: WebviewToHostMessageType.VSCODE_OPEN_RELATIVE,
    content: { relativePath: file.id },
  });
};

const fileActions = (file: ContentRecordFile): ActionButton[] => {
  let actions: ActionButton[] = [];

  if (file.reason?.exclude && file.reason?.source != FileMatchSource.BUILT_IN) {
    actions.push({
      label: file.isFile ? "Include this file" : "Include this folder",
      codicon: "codicon-diff-added",
      fn: () =>
        sendMsg({
          kind: WebviewToHostMessageType.INCLUDE_FILE,
          content: { path: file.id },
        }),
    });
  }

  if (!file.reason?.exclude) {
    actions.push({
      label: file.isFile ? "Exclude this file" : "Exclude this folder",
      codicon: "codicon-diff-removed",
      fn: () =>
        sendMsg({
          kind: WebviewToHostMessageType.EXCLUDE_FILE,
          content: { path: file.id },
        }),
    });
  }

  return actions;
};
</script>
