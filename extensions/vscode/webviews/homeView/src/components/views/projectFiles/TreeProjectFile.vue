<template>
  <TreeItem
    :key="file.id"
    :title="file.base"
    :indentLevel="indentLevel"
    v-on="{
      click: file.isFile ? openFile : undefined,
    }"
  >
    <template v-if="file.files.length" #default="{ indentLevel }">
      <TreeProjectFile
        v-for="child in file.files"
        :file="child"
        :indentLevel="indentLevel"
      />
    </template>
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
  indentLevel?: number;
}

const props = withDefaults(defineProps<Props>(), {
  indentLevel: 1,
});

const { sendMsg } = useHostConduitService();

const openFile = () => {
  sendMsg({
    kind: WebviewToHostMessageType.VSCODE_OPEN_RELATIVE,
    content: { relativePath: props.file.id },
  });
};
</script>
