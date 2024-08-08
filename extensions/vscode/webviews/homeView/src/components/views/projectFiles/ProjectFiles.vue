<template>
  <TreeSection
    title="Project Files"
    :actions="[
      swapViewLayoutAction,
      {
        label: 'Refresh Project Files',
        codicon: 'codicon-refresh',
        fn: () =>
          sendMsg({ kind: WebviewToHostMessageType.REQUEST_FILES_LISTS }),
      },
    ]"
  >
    <template v-if="home.files">
      <ListProjectFiles v-if="viewLayout === FilesViewLayout.LIST" />
      <TreeProjectFile
        v-else-if="viewLayout === FilesViewLayout.TREE"
        :file="home.files"
      />
    </template>
    <p v-else>No files found</p>
  </TreeSection>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import { WebviewToHostMessageType } from "../../../../../../src/types/messages/webviewToHostMessages";

import TreeSection from "src/components/TreeSection.vue";
import { useHomeStore } from "src/stores/home";
import { useHostConduitService } from "src/HostConduitService";
import ListProjectFiles from "src/components/views/projectFiles/ListProjectFiles.vue";
import TreeProjectFile from "src/components/views/projectFiles/TreeProjectFile.vue";

enum FilesViewLayout {
  LIST,
  TREE,
}

const home = useHomeStore();
const { sendMsg } = useHostConduitService();

const viewLayout = ref<FilesViewLayout>(FilesViewLayout.LIST);

const swapViewLayoutAction = computed(() => {
  if (viewLayout.value === FilesViewLayout.LIST) {
    return {
      label: "View as Tree",
      codicon: "codicon-list-tree",
      fn: () => {
        viewLayout.value = FilesViewLayout.TREE;
      },
    };
  } else {
    return {
      label: "View as List",
      codicon: "codicon-list-flat",
      fn: () => {
        viewLayout.value = FilesViewLayout.LIST;
      },
    };
  }
});
</script>
