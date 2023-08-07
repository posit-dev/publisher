<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-expansion-item>
    <template #header>
      <q-item-section avatar>
        <q-icon
          name="img:assets/images/files-icon.jpg"
          size="35px"
        />
      </q-item-section>

      <q-item-section>
        <q-item-label>Files</q-item-label>
      </q-item-section>
    </template>

    <q-card class="bg-grey-9">
      <q-card-section>
        <q-tree
          :nodes="files"
          node-key="key"
          tick-strategy="leaf"
          dark
          dense
        />
      </q-card-section>
    </q-card>
  </q-expansion-item>
</template>

<script setup lang="ts">
import type { QTree, QTreeNode } from 'quasar';
import { ref } from 'vue';

import { useApi, DeploymentFile } from 'src/api';

const api = useApi();

const files = ref<QTreeNode[]>([]);

function fileToTreeNode(file: DeploymentFile): QTreeNode {
  const node: QTreeNode = {
    key: file.pathname,
    label: file.pathname,
    children: file.files.map(fileToTreeNode),
  };

  return node;
}

async function getFiles() {
  const response = await api.files.get({ pathname: 'web/src/api' });
  files.value = [fileToTreeNode(response.data)];
}

getFiles();
</script>
