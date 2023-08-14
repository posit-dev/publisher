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
          v-model:ticked="deploymentStore.files"
          v-model:expanded="expanded"
          :nodes="files"
          :node-key="NODE_KEY"
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
import { useDeploymentStore } from 'src/stores/deployment';

const NODE_KEY = 'key';

const api = useApi();
const deploymentStore = useDeploymentStore();

const files = ref<QTreeNode[]>([]);
const expanded = ref<string[]>([]);

function fileToTreeNode(file: DeploymentFile): QTreeNode {
  const node: QTreeNode = {
    [NODE_KEY]: file.pathname,
    label: file.base_name,
    children: file.files.map(fileToTreeNode),
    tickable: !file.exclusion,
  };

  return node;
}

async function getFiles() {
  const response = await api.files.get({ pathname: 'web/src/api' });
  const file = response.data;

  files.value = [fileToTreeNode(file)];

  if (file.is_dir) {
    // start with the top level directory expanded
    expanded.value = [file.pathname];
  }
}

getFiles();
</script>
