<template>
  <RecycleScroller
    class="scroller"
    :items="files"
    :item-size="22"
    v-slot="{ item }"
  >
    <TreeItemCheckbox
      :title="item.base"
      :checked="isFileIncluded(item)"
      :disabled="
        item.reason?.source === 'built-in' ||
        item.reason?.source === 'permissions'
      "
      :list-style="
        isEntrypoint(item)
          ? 'emphasized'
          : isFileIncluded(item)
            ? 'default'
            : 'deemphasized'
      "
      :tooltip="
        isFileIncluded(item)
          ? includedFileTooltip(item)
          : excludedFileTooltip(item)
      "
      :indentLevel="item.indent + 1"
      :actions="fileActions(item)"
      @check="includeFile(item.id)"
      @uncheck="excludeFile(item.id)"
    >
      <template #postDecor>
        <PostDecor
          v-if="
            item.isFile &&
            isFileIncluded(item) &&
            !home.flatFiles.lastDeployedFiles.has(item.id)
          "
          class="text-git-added"
          :data-automation="`${item.id}-decorator`"
        >
          A
        </PostDecor>
        <PostDecor
          v-if="
            item.isFile &&
            !isFileIncluded(item) &&
            home.flatFiles.lastDeployedFiles.has(item.id)
          "
          class="text-git-deleted"
        >
          R
        </PostDecor>
      </template>
    </TreeItemCheckbox>
  </RecycleScroller>
</template>

<script setup lang="ts">
import TreeItemCheckbox from "src/components/tree/TreeItemCheckbox.vue";
import {
  includedFileTooltip,
  excludedFileTooltip,
} from "src/components/views/projectFiles/tooltips";
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
  files: FlatFile[];
}

defineProps<Props>();

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

<style lang="scss" scoped>
.scroller {
  max-height: 500px;
}
</style>
