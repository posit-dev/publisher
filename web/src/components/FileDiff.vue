<template>
  <q-option-group
    v-model="selectedFiles"
    :options="options"
    type="checkbox"
    dark
    dense
    keep-color
  >
    <template #label="option">
      {{ option.label }}
      <q-badge
        class="q-ml-xs"
        :color="option.color"
      >
        {{ option.status }}
      </q-badge>
    </template>
  </q-option-group>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { matCheckBox, matCheckBoxOutlineBlank, matAddBox, matDisabledByDefault } from '@quasar/extras/material-icons';

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
      result.color = 'red';
      result.status = 'deleted';
      result.uncheckedIcon = matDisabledByDefault;
    }
    if (node.changed) {
      result.color = 'orange';
      result.status = 'changed';
      result.checkedIcon = matCheckBox;
      result.uncheckedIcon = matCheckBoxOutlineBlank;
    }
    if (node.new) {
      result.color = 'green';
      result.status = 'new';
      result.checkedIcon = matAddBox;
      result.uncheckedIcon = matCheckBoxOutlineBlank;
    }

    return result;
  });
}
</script>
