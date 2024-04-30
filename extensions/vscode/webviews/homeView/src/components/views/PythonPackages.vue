<template>
  <TreeSection
    title="Python Packages"
    :actions="[
      {
        label: 'Edit Requirements File',
        codicon: 'codicon-edit',
        fn: () => {},
      },
      {
        label: 'Refresh Requirements',
        codicon: 'codicon-refresh',
        fn: () => {},
      },
      { label: 'Scan Requirements', codicon: 'codicon-eye', fn: () => {} },
    ]"
  >
    <TreeItem
      title="fastapi===3.6"
      codicon="codicon-package"
      align-icon-with-twisty
    />
  </TreeSection>
</template>

<script setup lang="ts">
import TreeItem from "src/components/TreeItem.vue";
import TreeSection from "src/components/TreeSection.vue";
</script>
