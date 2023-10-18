<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <LayoutPanel
    title="Files"
    :subtitle="fileSummary"
  >
    <template #avatar>
      <PublisherFolderLogo
        width="40px"
        height="40px"
        class="folder-logo"
      />
    </template>
    <q-tree
      v-model:ticked="deploymentStore.files"
      v-model:expanded="expanded"
      :nodes="files"
      :node-key="NODE_KEY"
      :control-color="colorStore.activePallete.files.controls"
      tick-strategy="leaf"
      dense
    />
  </LayoutPanel>
</template>

<script setup lang="ts">
import type { QTree, QTreeNode } from 'quasar';
import { ref, computed } from 'vue';

import LayoutPanel from 'src/components/configurePublish/LayoutPanel.vue';
import PublisherFolderLogo from 'src/components/icons/PublisherFolderLogo.vue';

import { useApi, DeploymentFile } from 'src/api';
import { useDeploymentStore } from 'src/stores/deployment';
import { useColorStore } from 'src/stores/color';
import { colorToHex } from 'src/utils/colorValues';

const NODE_KEY = 'key';

const api = useApi();
const deploymentStore = useDeploymentStore();
const colorStore = useColorStore();

const files = ref<QTreeNode[]>([]);
const expanded = ref<string[]>([]);

type FileInfo = Pick<DeploymentFile, 'size' | 'isEntrypoint' | 'exclusion' | 'isFile' >;

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
  const path = deploymentStore.deployment?.sourcePath;

  // Calculate the number of files that are "files" (i.e., regular files, not directories, symlinks, etc.)
  const count = deploymentStore.files
    .map(file => fileMap.value.get(file))
    .filter(info => info?.isFile)
    .length;

  if (count) {
    return `${count} files selected from ${path} (total = ${selectedFileTotalSize.value})`;
  } else if (path) {
    return `No files have been selected from ${path}`;
  }
  return '';
});

function fileToTreeNode(file: DeploymentFile): QTreeNode {
  const node: QTreeNode = {
    [NODE_KEY]: file.id,
    label: file.base,
    children: file.files.map(fileToTreeNode),
    tickable: !file.exclusion,
  };

  return node;
}

function populateFileMap(file: DeploymentFile) {
  const info = {
    size: file.size,
    isEntrypoint: file.isEntrypoint,
    exclusion: file.exclusion,
    isFile: file.isFile
  };
  fileMap.value.set(file.id, info);
  file.files.forEach(populateFileMap);
}

async function getFiles() {
  const response = await api.files.get();
  const file = response.data;

  files.value = [fileToTreeNode(file)];

  // updates fileMap
  populateFileMap(file);

  if (file.isDir) {
    // start with the top level directory expanded
    expanded.value = [file.rel];
  }
}

getFiles();
</script>

<style>
.folder-logo {
  fill: v-bind('colorToHex(colorStore.activePallete.icon.fill)');
  stroke: v-bind('colorToHex(colorStore.activePallete.icon.stroke)');
}
</style>
