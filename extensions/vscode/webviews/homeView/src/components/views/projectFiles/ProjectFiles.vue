<template>
  <TreeSection
    data-automation="project-files"
    title="Project Files"
    :actions="[
      {
        label: 'Refresh Project Files',
        codicon: 'codicon-refresh',
        fn: () =>
          sendMsg({ kind: WebviewToHostMessageType.REQUEST_FILES_LISTS }),
      },
    ]"
  >
    <template v-if="home.files">
      <TreeProjectFiles :files="home.files.files" />
    </template>
    <p v-else>No files found</p>
  </TreeSection>
</template>

<script setup lang="ts">
import { WebviewToHostMessageType } from "../../../../../../src/types/messages/webviewToHostMessages";

import TreeSection from "src/components/tree/TreeSection.vue";
import { useHomeStore } from "src/stores/home";
import { useHostConduitService } from "src/HostConduitService";
import TreeProjectFiles from "src/components/views/projectFiles/TreeProjectFiles.vue";

const home = useHomeStore();
const { sendMsg } = useHostConduitService();
</script>
