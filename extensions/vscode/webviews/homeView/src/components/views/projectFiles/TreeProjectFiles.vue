<template>
  <TreeItemCheckbox
    v-for="file in props.files"
    :key="file.id"
    :title="file.base"
    :checked="isFileIncluded(file)"
    :disabled="
      file.reason?.source === 'built-in' ||
      file.reason?.source === 'permissions'
    "
    :list-style="
      isEntrypoint(file)
        ? 'emphasized'
        : isFileIncluded(file)
          ? 'default'
          : 'deemphasized'
    "
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
    <template v-if="file.isDir" #default="{ indentLevel }">
      <TreeProjectFiles :files="file.files" :indentLevel="indentLevel" />
    </template>

    <template #postDecor>
      <PostDecor
        v-if="
          file.isFile &&
          isFileIncluded(file) &&
          !home.flatFiles.lastDeployedFiles.has(file.id)
        "
        class="text-git-added"
        :data-automation="`${file.id}-decorator`"
      >
        A
      </PostDecor>
      <PostDecor
        v-if="
          file.isFile &&
          !isFileIncluded(file) &&
          home.flatFiles.lastDeployedFiles.has(file.id)
        "
        class="text-git-deleted"
      >
        R
      </PostDecor>
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

import {
  ContentRecordFile,
  isConfigurationError,
} from "../../../../../../src/api";
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

const isEntrypoint = (file: ContentRecordFile): boolean => {
  const config = home.selectedConfiguration;
  if (config != undefined && !isConfigurationError(config)) {
    return file.id === config.configuration.entrypoint;
  }
  return false;
};

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
