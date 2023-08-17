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
        <q-item-label
          v-if="fileSummary"
          caption
        >
          {{ fileSummary }}
        </q-item-label>
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
import { ref, computed } from 'vue';

import { useApi, DeploymentFile } from 'src/api';
import { useDeploymentStore } from 'src/stores/deployment';

const NODE_KEY = 'key';

const api = useApi();
const deploymentStore = useDeploymentStore();

const files = ref<QTreeNode[]>([]);
const expanded = ref<string[]>([]);

type FileInfo = Pick<DeploymentFile, 'size' | 'is_entrypoint' | 'exclusion'>;

const fileMap = ref(new Map<string, FileInfo>());

const selectedFileTotalSize = computed(() : string => {
  let totalSize = 0;
  deploymentStore.files.forEach(fileName => {
    const fileInfo = fileMap.value.get(fileName);
    if (fileInfo) {
      totalSize += fileInfo.size;
    }
  });
  let totalSizeStr = `${totalSize} bytes`;
  if (totalSize > 1024 * 1024) {
    totalSizeStr = `${(totalSize / 1024).toFixed(1)} MB`;
  } else if (totalSize > 1024) {
    totalSizeStr = `${(totalSize / 1024).toFixed(1)} KB`;
  }
  return totalSizeStr;
});

const fileSummary = computed(() => {
  const count = deploymentStore.files.length;
  const path = deploymentStore.deployment?.source_path;

  if (count) {
    return `${count} files selected from ${path} (total = ${selectedFileTotalSize.value})`;
  } else if (path) {
    return `No files have been selected from ${path}`;
  }
  return '';
});

function fileToTreeNode(file: DeploymentFile): QTreeNode {
  const node: QTreeNode = {
    [NODE_KEY]: file.pathname,
    label: file.base_name,
    children: file.files.map(fileToTreeNode),
    tickable: !file.exclusion,
  };

  return node;
}

function populateFileMap(file: DeploymentFile) {
  const info = {
    size: file.size,
    // eslint-disable-next-line camelcase
    is_entrypoint: file.is_entrypoint,
    exclusion: file.exclusion,
  };
  fileMap.value.set(file.pathname, info);
  file.files.forEach(populateFileMap);
}

async function getFiles() {
  const response = await api.files.get();
  const file = response.data;

  files.value = [fileToTreeNode(file)];

  // updates fileMap
  populateFileMap(file);

  if (file.is_dir) {
    // start with the top level directory expanded
    expanded.value = [file.pathname];
  }
}

getFiles();
</script>
