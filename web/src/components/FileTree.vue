<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-tree
    v-model:expanded="expanded"
    :nodes="files"
    :node-key="NODE_KEY"
    dense
  >
    <template #default-header="{ node }">
      <q-icon
        v-if="node.icon"
        class="q-mr-sm"
        :name="node.icon"
      />
      <div :class="{ 'excluded-file': node.exclusion }">
        {{ node.label }}
        <q-tooltip
          v-if="node.exclusion"
          class="text-body2"
          anchor="center right"
          self="center left"
          :offset="[10, 10]"
        >
          {{ node.exclusion }}
        </q-tooltip>
      </div>
    </template>
  </q-tree>
</template>

<script setup lang="ts">
import { QTreeNode } from 'quasar';
import { ref } from 'vue';

import { useApi } from 'src/api';
import { DeploymentFile } from 'src/api/types/files';
import { routeToErrorPage, getErrorMessage } from 'src/util/errors';
import { useRouter } from 'vue-router';

const NODE_KEY = 'key';

const api = useApi();
const router = useRouter();

const files = ref<QTreeNode[]>([]);
const expanded = ref<string[]>([]);

function fileToTreeNode(file: DeploymentFile): QTreeNode {
  const node: QTreeNode = {
    [NODE_KEY]: file.id,
    label: file.base,
    children: file.files.map(fileToTreeNode),
    icon: file.isDir ? 'folder' : undefined,
    exclusion: file.exclusion,
  };

  return node;
}

async function getFiles() {
  try {
    const response = await api.files.get();
    const file = response.data;

    files.value = [fileToTreeNode(file)];

    if (file.isDir) {
      // start with the top level directory expanded
      expanded.value = [file.rel];
    }
  } catch (err: unknown) {
    // Fatal!
    routeToErrorPage(
      router,
      getErrorMessage(err),
      'FileTree::getFiles'
    );
  }
}

getFiles();
</script>

<style scoped lang="scss">
.excluded-file {
  opacity: 60%;
}
</style>

