<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <LayoutPanel
    title="Files"
    :subtitle="fileSummary"
    icon="img:/images/files-icon.jpg"
    group="main"
  >
    <q-banner v-if="redeploy" dark class="bg-blue-8 text-white q-ma-sm">
      TODO: File Diff is going to be revisited (as perhaps a list organized by new, deleted, updated and unchanged).
      File Tree needs to have options to allow overriding of excluded/soft-filtered entries.
    </q-banner>
    <div v-if="redeploy">
      <q-tabs
        v-model="tab"
        dense
        class="text-grey"
        active-color="white"
        active
        indicator-color="primary"
        align="justify"
        narrow-indicator
      >
        <q-tab
          name="fileTree"
          label="File Tree View (current)"
          dark
        />
        <q-tab
          name="fileDiff"
          label="File Diff View (since last deployment)"
          dark
        />
      </q-tabs>
      <q-separator />
      <q-tab-panels
        v-model="tab"
        animated
        dark
      >
        <q-tab-panel name="fileDiff">
          <FileDiff />
        </q-tab-panel>
      </q-tab-panels>
      <q-tab-panels
        v-model="tab"
        animated
        dark
      >
        <q-tab-panel name="fileTree">
          <q-tree
            v-model:ticked="deploymentStore.files"
            v-model:expanded="expanded"
            :nodes="files"
            :node-key="NODE_KEY"
            tick-strategy="leaf"
            dark
            dense
          />
        </q-tab-panel>
      </q-tab-panels>
    </div>
    <q-tree
      v-if="!redeploy"
      v-model:ticked="deploymentStore.files"
      v-model:expanded="expanded"
      :nodes="files"
      :node-key="NODE_KEY"
      tick-strategy="leaf"
      dark
      dense
    />
    <q-select
      v-model="entryPoint"
      :options="entryPointOptions"
      label="Entry Point File"
      map-options
      dark
      outlined
      style="width: 100%"
      class="q-ma-sm q-mt-md"
    />
  </LayoutPanel>
</template>

<script setup lang="ts">
import type { QTree, QTreeNode } from 'quasar';
import { ref, computed } from 'vue';

import LayoutPanel from 'src/components/LayoutPanel.vue';
import FileDiff from 'src/components/FileDiff.vue';
import { useApi, DeploymentFile } from 'src/api';
import { useDeploymentStore } from 'src/stores/deployment';

const props = defineProps({
  redeploy: { type: Boolean, required: true }
});

const NODE_KEY = 'key';

const api = useApi();
const deploymentStore = useDeploymentStore();

const files = ref<QTreeNode[]>([]);
const expanded = ref<string[]>([]);
const tab = ref('fileDiff');

type FileInfo = Pick<DeploymentFile, 'size' | 'isEntrypoint' | 'exclusion'>;

const fileMap = ref(new Map<string, FileInfo>());
const entryPointOptions = ref(<string[]>[]);

const entryPoint = ref('');

const selectedFileTotalSize = computed(() : string => {
  let totalSize = 0;
  deploymentStore.files.forEach(fileName => {
    const fileInfo = fileMap.value.get(fileName);
    if (fileInfo) {
      totalSize += fileInfo.size;
    }
    if (fileName.endsWith('.py') && !entryPointOptions.value.includes(fileName)) {
      entryPointOptions.value.push(fileName);
      if (entryPoint.value === '') {
        entryPoint.value = fileName;
      }
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
  const path = deploymentStore.deployment?.sourcePath;

  if (count) {
    if (!props.redeploy) {
      return `${entryPoint.value} (entrypoint) and ${count - 1} files selected from ${path} (total = ${selectedFileTotalSize.value}).`;
    }
    return `${entryPoint.value} (entrypoint) and ${count - 1} files selected from ${path} (total = ${selectedFileTotalSize.value}). WARNING: 1 file removed since last deployment.`;
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
