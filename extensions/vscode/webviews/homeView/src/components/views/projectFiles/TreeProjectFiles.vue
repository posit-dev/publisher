<template>
  <TreeItemCheckbox
    v-for="[id, file] in props.files"
    :key="id"
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
    :indentLevel="file.indent"
    :actions="fileActions(file)"
    @check="includeFile(id)"
    @uncheck="excludeFile(id)"
  >
    <!-- <template v-if="file.isDir" #default="{ indentLevel }">
      <TreeProjectFiles :files="file.files" :indentLevel="indentLevel" />
    </template> -->

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
import { FlatFile } from "src/utils/files";

import {
  ContentRecordFile,
  isConfigurationError,
} from "../../../../../../src/api";
import { WebviewToHostMessageType } from "../../../../../../src/types/messages/webviewToHostMessages";

interface Props {
  files: Map<string, FlatFile>;
  indentLevel?: number;
}

const props = withDefaults(defineProps<Props>(), {
  indentLevel: 1,
});

const home = useHomeStore();
const { sendMsg } = useHostConduitService();

const isEntrypoint = (file: Pick<ContentRecordFile, "id">): boolean => {
  const config = home.selectedConfiguration;
  if (config != undefined && !isConfigurationError(config)) {
    return file.id === config.configuration.entrypoint;
  }
  return false;
};

const isFileIncluded = (file: Pick<ContentRecordFile, "reason">) => {
  return Boolean(file.reason?.exclude === false);
};

const includeFile = (id: string) => {
  sendMsg({
    kind: WebviewToHostMessageType.INCLUDE_FILE,
    content: { path: id },
  });
};

const excludeFile = (id: string) => {
  sendMsg({
    kind: WebviewToHostMessageType.EXCLUDE_FILE,
    content: { path: id },
  });
};

const openFile = (id: string) => {
  sendMsg({
    kind: WebviewToHostMessageType.VSCODE_OPEN_RELATIVE,
    content: { relativePath: id },
  });
};

const fileActions = (
  file: Pick<ContentRecordFile, "id" | "isFile">,
): ActionButton[] => {
  let actions: ActionButton[] = [];

  if (file.isFile) {
    actions.push({
      label: "Open file",
      codicon: "codicon-link-external",
      fn: () => {
        openFile(file.id);
      },
    });
  }

  return actions;
};
</script>
