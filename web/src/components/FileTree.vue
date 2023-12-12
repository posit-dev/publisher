<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-tree
    v-model:expanded="expanded"
    :nodes="files"
    :node-key="NODE_KEY"
    dense
  />
</template>

<script setup lang="ts">
import { QTreeNode } from 'quasar';
import { ref } from 'vue';

import { useApi } from 'src/api';
import { DeploymentFile } from 'src/api/types/files';

const NODE_KEY = 'key';

const api = useApi();

const files = ref<QTreeNode[]>([]);
const expanded = ref<string[]>([]);

function fileToTreeNode(file: DeploymentFile): QTreeNode {
  const node: QTreeNode = {
    [NODE_KEY]: file.id,
    label: file.base,
    children: file.files.map(fileToTreeNode),
    disabled: Boolean(file.exclusion),
    icon: file.isDir ? 'folder' : undefined,
  };

  return node;
}

async function getFiles() {
  const response = await api.files.get();
  const file = response.data;

  files.value = [fileToTreeNode(file)];

  if (file.isDir) {
    // start with the top level directory expanded
    expanded.value = [file.rel];
  }
}

getFiles();
</script>

