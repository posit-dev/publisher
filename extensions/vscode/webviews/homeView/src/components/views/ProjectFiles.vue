<template>
  <TreeSection
    title="Project Files"
    :actions="[
      {
        label: 'Refresh Project Files',
        codicon: 'codicon-refresh',
        fn: () => {},
      },
    ]"
  >
    <TreeItem
      v-model:expanded="includedExpanded"
      title="Included Files"
      codicon="codicon-list-unordered"
    >
      <template #default="{ indentLevel }">
        <TreeItem
          title="meta.yaml"
          codicon="codicon-debug-stackframe-dot"
          :indentLevel="indentLevel"
        />
        <TreeItem
          title="requirements.in"
          codicon="codicon-debug-stackframe-dot"
          :indentLevel="indentLevel"
        />
        <TreeItem
          title="requirements.txt"
          codicon="codicon-debug-stackframe-dot"
          :indentLevel="indentLevel"
        />
        <TreeItem
          title="simple.py"
          codicon="codicon-debug-stackframe-dot"
          :indentLevel="indentLevel"
        />
      </template>
    </TreeItem>

    <TreeItem
      v-model:expanded="excludedExpanded"
      title="Excluded Files"
      codicon="codicon-list-unordered"
    >
      <template #default="{ indentLevel }">
        <TreeItem
          title=".DS_Store"
          codicon="codicon-debug-stackframe-dot"
          :indentLevel="indentLevel"
        />
        <TreeItem
          title="manifest.json"
          codicon="codicon-debug-stackframe-dot"
          :indentLevel="indentLevel"
        />
      </template>
    </TreeItem>
  </TreeSection>
</template>

<script setup lang="ts">
import { ref } from "vue";

import TreeItem from "../TreeItem.vue";
import TreeSection from "../TreeSection.vue";

const includedExpanded = ref(true);
const excludedExpanded = ref(true);
</script>
