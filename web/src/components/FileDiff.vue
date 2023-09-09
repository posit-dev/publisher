<template>
  <q-option-group
    v-model="selectedFiles"
    :options="options"
    type="checkbox"
    dark
    dense
  >
    <template #label="option">
      {{ option.label }}
      <q-badge
        class="q-ml-xs"
        :color="option.tagColor"
      >
        {{ option.status }}
      </q-badge>
    </template>
  </q-option-group>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import { DirectoryNode, FLATTENED_CHANGED_DIRECTORY_DATA } from 'src/api/directoryContents';

type QuasarOption = {
  [props: string]: any;
  label: string;
  value: any;
  disable?: boolean | undefined;
};

const selectedFiles = ref<string[]>(
  FLATTENED_CHANGED_DIRECTORY_DATA.filter(
    (node) => node.new || node.changed
  ).map(node => node.path)
);
const options = ref(filesToQausarOptions(FLATTENED_CHANGED_DIRECTORY_DATA));

function filesToQausarOptions(files: DirectoryNode[]): QuasarOption[] {
  return files.map((node) => {
    const result: QuasarOption = {
      label: node.path,
      value: node.path,
    };

    if (node.deleted) {
      result.disable = true;
      result.tagColor = 'red';
      result.status = 'deleted';
    }
    if (node.changed) {
      result.tagColor = 'orange';
      result.status = 'changed';
    }
    if (node.new) {
      result.tagColor = 'green';
      result.status = 'new';
    }

    return result;
  });
}
</script>
