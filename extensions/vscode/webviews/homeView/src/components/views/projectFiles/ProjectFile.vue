<template>
  <TreeItemCheckbox
    :title="file.base"
    :state="checkState"
    :disabled="isDisabled"
    :list-style="listStyle"
    :disable-opacity="isEntrypoint || isPackageFile"
    :indent-level="file.indent + 1"
    :expandable="file.isDir"
    :tooltip="tooltip"
    :virtualized="true"
    @check="fileStore.includeFile(file)"
    @uncheck="fileStore.excludeFile(file)"
    @expand="fileStore.expandDir(file)"
    @collapse="fileStore.collapseDir(file)"
    @click="openFile"
  >
    <template #postDecor>
      <PostDecor
        v-if="isBeingAdded"
        class="text-git-added"
        :data-automation="`${file.id}-decorator`"
      >
        A
      </PostDecor>
      <PostDecor v-if="isBeingRemoved" class="text-git-deleted">R</PostDecor>
    </template>
  </TreeItemCheckbox>
</template>

<script setup lang="ts">
import { computed } from "vue";

import TreeItemCheckbox from "src/components/tree/TreeItemCheckbox.vue";
import { type CheckState } from "src/components/CodeCheckbox.vue";
import { useHomeStore } from "src/stores/home";
import { useFileStore } from "src/stores/file";
import { FlatFile } from "src/utils/files";
import {
  excludedFileTooltip,
  includedFileTooltip,
} from "src/components/views/projectFiles/tooltips";
import { isConfigurationError } from "../../../../../../src/api";

/**
 * This component is used for list virtualization. It must be reactive to the
 * item prop being updated without being re-created.
 * See: https://github.com/Akryum/vue-virtual-scroller/blob/master/packages/vue-virtual-scroller/README.md#important-notes
 */
interface Props {
  file: FlatFile;
}

const props = defineProps<Props>();

const home = useHomeStore();
const fileStore = useFileStore();

const isDisabled = computed((): boolean => {
  const source = props.file.reason?.source;
  return (
    (isEntrypoint.value && isIncluded.value) ||
    (isPackageFile.value && isIncluded.value) ||
    source === "built-in" ||
    source === "permissions"
  );
});

const isIncluded = computed((): boolean => {
  return Boolean(props.file.reason?.exclude === false);
});

const checkState = computed((): CheckState => {
  // Directories with children use tri-state based on child inclusion
  if (props.file.isDir && props.file.fileCount > 0) {
    if (props.file.allIncluded) {
      // Every child is included
      return "checked";
    }
    if (props.file.allExcluded) {
      // Every child is excluded
      return "unchecked";
    }
    // Some children included, some excluded
    return "indeterminate";
  }
  // Individual files are either included or not
  return isIncluded.value ? "checked" : "unchecked";
});

const inLastDeployed = computed(() => {
  return fileStore.lastDeployedFiles.has(props.file.id);
});

const isBeingAdded = computed(() => {
  return props.file.isFile && isIncluded.value && !inLastDeployed.value;
});

const isBeingRemoved = computed(() => {
  return props.file.isFile && !isIncluded.value && inLastDeployed.value;
});

const isEntrypoint = computed((): boolean => {
  const config = home.selectedConfiguration;
  if (config != undefined && !isConfigurationError(config)) {
    return props.file.id === config.configuration.entrypoint;
  }
  return false;
});

const isPackageFile = computed((): boolean => {
  return isPythonPackageFile.value || isRPackageFile.value;
});

const isPythonPackageFile = computed((): boolean => {
  const config = home.selectedConfiguration;
  if (config != undefined && !isConfigurationError(config)) {
    return props.file.id === config.configuration.python?.packageFile;
  }
  return false;
});

const isRPackageFile = computed((): boolean => {
  const config = home.selectedConfiguration;
  if (config != undefined && !isConfigurationError(config)) {
    return props.file.id === config.configuration.r?.packageFile;
  }
  return false;
});

const listStyle = computed((): "emphasized" | "default" | "deemphasized" => {
  return isEntrypoint.value
    ? "emphasized"
    : checkState.value !== "unchecked"
      ? "default"
      : "deemphasized";
});

const tooltip = computed((): string => {
  if (checkState.value === "indeterminate") {
    return `${props.file.rel} contains a mix of included and excluded files.`;
  }
  return isIncluded.value
    ? includedFileTooltip(props.file, {
        isEntrypoint: isEntrypoint.value,
        isPackageFile: isPackageFile.value,
      })
    : excludedFileTooltip(props.file);
});

const openFile = () => {
  if (props.file.isFile) {
    fileStore.openFile(props.file);
  }
};
</script>
