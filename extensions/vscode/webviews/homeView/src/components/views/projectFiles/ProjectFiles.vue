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
    <template v-if="fileStore.flatFiles.length">
      <RecycleScroller
        class="scroller"
        :items="fileStore.flatFiles"
        :item-size="22"
        v-slot="{ item }"
      >
        <ProjectFile :file="item" />
      </RecycleScroller>
    </template>
    <p v-else>No files found</p>
  </TreeSection>
</template>

<script setup lang="ts">
import TreeSection from "src/components/tree/TreeSection.vue";
import { useFileStore } from "src/stores/file";
import ProjectFile from "src/components/views/projectFiles/ProjectFile.vue";

const fileStore = useFileStore();
</script>

<style lang="scss" scoped>
.scroller {
  max-height: 500px;
}
</style>
