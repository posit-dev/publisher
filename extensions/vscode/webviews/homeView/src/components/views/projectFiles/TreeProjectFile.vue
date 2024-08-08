<template>
  <TreeItem
    v-if="file"
    :key="file.id"
    :title="file.base"
    v-on="{
      click: file.isFile ? openFile : undefined,
    }"
  >
    <TreeProjectFile v-for="child in file.files" :file="child" />
  </TreeItem>
</template>

<script setup lang="ts">
import TreeItem from "src/components/TreeItem.vue";
import TreeProjectFile from "src/components/views/projectFiles/TreeProjectFile.vue";
import { useHostConduitService } from "src/HostConduitService";

import { ContentRecordFile } from "../../../../../../src/api";
import { WebviewToHostMessageType } from "../../../../../../src/types/messages/webviewToHostMessages";

interface Props {
  file: ContentRecordFile;
}
const props = defineProps<Props>();

const { sendMsg } = useHostConduitService();

const openFile = () => {
  sendMsg({
    kind: WebviewToHostMessageType.VSCODE_OPEN_RELATIVE,
    content: { relativePath: props.file.id },
  });
};
</script>
