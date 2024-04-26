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
          :actions="[
            {
              label: 'Exclude this file',
              codicon: 'codicon-diff-removed',
              fn: () => {},
            },
          ]"
        />
        <TreeItem
          title="requirements.in"
          codicon="codicon-debug-stackframe-dot"
          :indentLevel="indentLevel"
          :actions="[
            {
              label: 'Exclude this file',
              codicon: 'codicon-diff-removed',
              fn: () => {},
            },
          ]"
        />
        <TreeItem
          title="requirements.txt"
          codicon="codicon-debug-stackframe-dot"
          :indentLevel="indentLevel"
          :actions="[
            {
              label: 'Exclude this file',
              codicon: 'codicon-diff-removed',
              fn: () => {},
            },
          ]"
        />
        <TreeItem
          title="simple.py"
          codicon="codicon-debug-stackframe-dot"
          :indentLevel="indentLevel"
          :actions="[
            {
              label: 'Exclude this file',
              codicon: 'codicon-diff-removed',
              fn: () => {},
            },
          ]"
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
        <TreeItem
          title="some-other-file.py"
          codicon="codicon-debug-stackframe-dot"
          :indentLevel="indentLevel"
          :actions="[
            {
              label: 'Include this file',
              codicon: 'codicon-diff-added',
              fn: () => {},
            },
          ]"
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
