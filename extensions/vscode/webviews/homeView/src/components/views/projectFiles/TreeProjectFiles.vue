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

    <template
      #postDecor
      v-if="
        file.isFile &&
        file.reason?.source !== FileMatchSource.BUILT_IN &&
        !home.flatFiles.lastDeployedFiles.has(file.rel)
      "
    >
      <PostDecor class="text-git-added">A</PostDecor>
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
import { useHomeStore } from "src/stores/home";
import { useHostConduitService } from "src/HostConduitService";
import PostDecor from "src/components/PostDecor.vue";
import { ActionButton } from "src/components/ActionToolbar.vue";
import { canFileBeExcluded, canFileBeIncluded } from "src/utils/files";

import { ContentRecordFile, FileMatchSource } from "../../../../../../src/api";
import { WebviewToHostMessageType } from "../../../../../../src/types/messages/webviewToHostMessages";

interface Props {
  files: ContentRecordFile[];
  indentLevel?: number;
}

const props = withDefaults(defineProps<Props>(), {
  indentLevel: 1,
});

const home = useHomeStore();
const { sendMsg } = useHostConduitService();

const openFile = (file: ContentRecordFile) => {
  sendMsg({
    kind: WebviewToHostMessageType.VSCODE_OPEN_RELATIVE,
    content: { relativePath: file.id },
  });
};

const fileActions = (file: ContentRecordFile): ActionButton[] => {
  let actions: ActionButton[] = [];

  if (canFileBeIncluded(file)) {
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

  if (canFileBeExcluded(file)) {
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
