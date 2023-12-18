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
          {{ exclusionDisplay(node.exclusion) }}
        </q-tooltip>
      </div>
    </template>
  </q-tree>
</template>

<script setup lang="ts">
import { QTreeNode } from 'quasar';
import { ref } from 'vue';

import { useApi } from 'src/api';
import { DeploymentFile, ExclusionMatch, ExclusionMatchSource } from 'src/api/types/files';
import {
  checkForResponseWithStatus,
  getSummaryFromError,
  newFatalErrorRouteLocation,
} from 'src/util/errors';
import { useRouter } from 'vue-router';

const NODE_KEY = 'key';

const api = useApi();
const router = useRouter();

const files = ref<QTreeNode[]>([]);
const expanded = ref<string[]>([]);

function fileToTreeNode(file: DeploymentFile) {
  const node: QTreeNode & Pick<DeploymentFile, 'exclusion'> = {
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
    // Returns:
    // 200 - success
    // 403 - pathname is not safe - forbidden
    // 500 - internal server error
    const response = await api.files.get();
    const file = response.data;

    files.value = [fileToTreeNode(file)];

    if (file.isDir) {
      // start with the top level directory expanded
      expanded.value = [file.rel];
    }
  } catch (error: unknown) {
    if (checkForResponseWithStatus(error, 403)) {
      throw new Error(`API Error: ${getSummaryFromError(error)}`);
    } else {
      router.push(newFatalErrorRouteLocation(error, 'FileTree: getFiles()'));
    }
  }
}

function exclusionDisplay(match: ExclusionMatch): string {
  switch (match.source) {
    case ExclusionMatchSource.BUILT_IN:
      return 'Automatically ignored by Posit Publisher';
    case ExclusionMatchSource.FILE:
      return `Ignored by "${match.filePath}" on line ${match.line} with pattern "${match.pattern}"`;
  }
}

getFiles();
</script>

<style scoped lang="scss">
.excluded-file {
  opacity: 60%;
}
</style>
