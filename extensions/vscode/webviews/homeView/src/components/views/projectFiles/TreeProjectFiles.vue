<template>
  <TreeItemCheckbox
    v-for="file in props.files"
    :key="file.id"
    :title="file.base"
    :checked="isFileIncluded(file)"
    :disabled="file.reason?.source === 'built-in'"
    :list-style="isFileIncluded(file) ? 'default' : 'deemphasized'"
    :tooltip="
      isFileIncluded(file)
        ? includedFileTooltip(file)
        : excludedFileTooltip(file)
    "
    :indentLevel="indentLevel"
    :actions="fileActions(file)"
    @check="includeFile(file)"
    @uncheck="excludeFile(file)"
  >
    <template v-if="file.files.length" #default="{ indentLevel }">
      <TreeProjectFiles :files="file.files" :indentLevel="indentLevel" />
    </template>

    <template
      #postDecor
      v-if="
        file.isFile &&
        isFileIncluded(file) &&
        !home.flatFiles.lastDeployedFiles.has(file.rel)
      "
    >
      <PostDecor class="text-git-added">A</PostDecor>
    </template>
  </TreeItemCheckbox>
</template>

<script setup lang="ts">
import TreeItemCheckbox from "src/components/tree/TreeItemCheckbox.vue";
import {
  includedFileTooltip,
  excludedFileTooltip,
} from "src/components/views/projectFiles/tooltips";
import TreeProjectFiles from "src/components/views/projectFiles/TreeProjectFiles.vue";
import { useHomeStore } from "src/stores/home";
import { useHostConduitService } from "src/HostConduitService";
import PostDecor from "src/components/tree/PostDecor.vue";
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

const home = useHomeStore();
const { sendMsg } = useHostConduitService();

const isFileIncluded = (file: ContentRecordFile) => {
  return Boolean(file.reason?.exclude === false);
};

const includeFile = (file: ContentRecordFile) => {
  sendMsg({
    kind: WebviewToHostMessageType.INCLUDE_FILE,
    content: { path: file.id },
  });
};

const excludeFile = (file: ContentRecordFile) => {
  sendMsg({
    kind: WebviewToHostMessageType.EXCLUDE_FILE,
    content: { path: file.id },
  });
};

const openFile = (file: ContentRecordFile) => {
  sendMsg({
    kind: WebviewToHostMessageType.VSCODE_OPEN_RELATIVE,
    content: { relativePath: file.id },
  });
};

const fileActions = (file: ContentRecordFile): ActionButton[] => {
  let actions: ActionButton[] = [];

  if (file.isFile) {
    actions.push({
      label: "Open file",
      codicon: "codicon-link-external",
      fn: () => {
        openFile(file);
      },
    });
  }

  return actions;
};
</script>
