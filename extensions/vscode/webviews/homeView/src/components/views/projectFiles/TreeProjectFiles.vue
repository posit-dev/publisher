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

import { ContentRecordFile } from "../../../../../../src/api";
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
</script>
