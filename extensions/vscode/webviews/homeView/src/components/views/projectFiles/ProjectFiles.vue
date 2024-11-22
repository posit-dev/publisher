<template>
  <TreeSection
    data-automation="project-files"
    title="Project Files"
    :actions="[
      {
        label: 'Refresh Project Files',
        codicon: 'codicon-refresh',
        fn: () => fileStore.refreshFiles,
      },
    ]"
  >
    <template v-if="fileStore.flatFiles">
      <TreeProjectFiles :files="fileStore.flatFiles" />
    </template>
    <p v-else>No files found</p>
  </TreeSection>
</template>

<script setup lang="ts">
import TreeSection from "src/components/tree/TreeSection.vue";
import TreeProjectFiles from "src/components/views/projectFiles/TreeProjectFiles.vue";
import { useFileStore } from "src/stores/file";

const fileStore = useFileStore();
</script>
