<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-expansion-item
    v-model="filesExpanded"
  >
    <template #header>
      <q-item-section avatar>
        <q-icon
          name="img:assets/images/files-icon.jpg"
          size="35px"
        />
      </q-item-section>

      <q-item-section>
        <q-item-label>Files</q-item-label>
        <q-item-label caption>
          {{ calculatedFilesSummary }}
          <q-tooltip
            v-if="!acknowledgeDifferences"
          >
            {{ parentAddedOrDeletedFilesDisplayString(0) }}
          </q-tooltip>
          <q-icon
            v-if="!filesExpanded && !addedOrDeletedFiles?.empty && !acknowledgeDifferences"
            name="img:assets/images/alert-icon.png"
            size="15px"
          />
        </q-item-label>
      </q-item-section>
    </template>

    <q-card class="bg-grey-9">
      <q-card-section>
        <div class="q-pa-xs row q-col-gutter-sm">
          <q-checkbox
            v-model="simulateReploymentMode"
            label="Simulate redeployment view"
            left-label
            dark
          />
        </div>
        <div class="q-pa-xs row q-col-gutter-sm">
          <q-checkbox
            v-model="treeEnableExcluded"
            label="Allow Selection of Disabled/Filtered Files"
            left-label
            dark
            @click="updateDisabledQTreeNodes"
          />
        </div>
        <div
          v-if="simulateReploymentMode"
          class="q-pa-xs row q-col-gutter-sm"
        >
          <q-checkbox
            v-model="acknowledgeDifferences"
            label="Acknowledge file differences (hide warnings, deletions and badges)"
            left-label
            dark
          />
        </div>
        <div class="q-pa-sm row q-col-gutter-sm">
          <q-tree
            ref="fileTree"
            v-model:selected="selected"
            v-model:ticked="ticked"
            v-model:expanded="expanded"
            :nodes="qTreeNodes"
            node-key="key"
            tick-strategy="leaf"
            dark
            dense
            @update:ticked="onTick"
          >
            <template #default-header="prop">
              <div class="row items-center">
                <div
                  v-if="prop.node.deleted"
                  class="q-tree__node-header-content disabled"
                >
                  {{ prop.node.label }}
                  <q-badge
                    align="middle"
                    color="orange"
                  >
                    deleted
                  </q-badge>
                </div>
                <div
                  v-else-if="!prop.node.showDisabled"
                  class="q-tree__node-header-content"
                  @click="handleNodeLabelClick(prop.node)"
                >
                  {{ prop.node.label }}
                  <q-badge
                    v-if="prop.node.new && !acknowledgeDifferences"
                    align="middle"
                    color="green"
                  >
                    new
                  </q-badge>
                  <q-tooltip>
                    {{ parentAddedOrDeletedFilesDisplayString(prop.node.key) }}
                  </q-tooltip>
                  <q-icon
                    v-if="showChangedBadges(prop.node) && !acknowledgeDifferences"
                    name="img:assets/images/alert-icon.png"
                    size="15px"
                  />
                </div>
                <div
                  v-else-if="prop.node.showDisabled"
                  class="q-tree__node-header-content disabled"
                >
                  {{ prop.node.label }}
                  <q-badge
                    v-if="prop.node.new && !acknowledgeDifferences"
                    align="middle"
                    color="green"
                  >
                    new
                  </q-badge>
                  <q-tooltip>
                    {{ parentAddedOrDeletedFilesDisplayString(prop.node.key) }}
                  </q-tooltip>
                  <q-icon
                    v-if="showChangedBadges(prop.node)"
                    name="img:assets/images/alert-icon.png"
                    size="15px"
                  />
                </div>
              </div>
            </template>
          </q-tree>
        </div>
        <div class="q-pa-md row q-col-gutter-sm">
          <q-select
            v-model="entryPoint"
            :options="entryPointOptions"
            label="Entry Point File"
            map-options
            dark
            outlined
            style="width: 100%"
          >
            <template #append>
              <q-icon
                name="close"
                class="cursor-pointer"
                @click.stop.prevent="entryPoint = null"
              />
            </template>
          </q-select>
        </div>
        <div class="q-pa-md row q-col-gutter-sm">
          <div class="col-12 col-sm-6 q-gutter-sm">
            <div class="text-h6 q-mb-md q-mr-lg">
              Selected {{ numberOfDirectories }} directories and {{ numberOfFiles }} files
            </div>
            <div>
              <div
                v-for="tickedKey in ticked"
                :key="tickedKey"
                class="q-mr-lg"
              >
                {{ getPathFromKey(tickedKey) }}
              </div>
            </div>
          </div>
          <div class="col-12 col-sm-6 q-gutter-sm">
            <div class="text-h6 q-mb-md">
              ignore list/rules
            </div>
            <div>
              <div
                v-for="rule in ignoreRules"
                :key="rule"
              >
                {{ rule }}
              </div>
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </q-expansion-item>
</template>

<script setup lang="ts">

import { ref, Ref, watch, reactive, computed, onBeforeMount } from 'vue';

import type { QSelectOption, QTree } from 'quasar';
import type { NodeType, DirectoryNode } from '../api/directoryContents';
import { directoryData, SampleIncomingRules, baseDir } from '../api/directoryContents';

type EntryPointOption = QSelectOption<number>;

interface QTreeNode {
  label: string;
  type?: string;
  key: number;
  size?: string;
  time?: string;
  // lazy: boolean;
  disabled: boolean;
  tickable: boolean;
  showDisabled: boolean;
  children: QTreeNode[];
  deleted?: boolean;
  new?: boolean;
}

interface IAddedOrDeletedFiles {
  added: number[];
  deleted: number[];
  empty: boolean;
}

const selected = ref('');
const ticked: Ref<number[]> = ref([]);
const expanded: Ref<number[]> = ref([0]);
const ignoreRules: Ref<string[]> = ref([]);
const treeEnableExcluded = ref(false);

const filesExpanded = ref(false);
const acknowledgeDifferences = ref(false);

const entryPoint = ref<EntryPointOption | null>(null);
const entryPointOptions: Ref<EntryPointOption[]> = ref([]);
const simulateReploymentMode = ref(false);

let nextToggleSelectionStateToTrue = true;

// The following line establishes a component ref in $refs that we can work with
const fileTree = ref(null);

const fileNodesMap = reactive(new Map<number, DirectoryNode>());
const qTreeNodesMap = reactive(new Map<number, QTreeNode>());

let qTreeNodes: QTreeNode[] = [];

watch(
  simulateReploymentMode,
  () => {
    updateDisplayRedeploymentDiffs();
  }
);

watch(acknowledgeDifferences, () => {
  qTreeNodes = convertNodesToData(directoryData);
  onTick();
});

const numberOfDirectories = computed(() => getNumOfType('directory'));

const numberOfFiles = computed(() => getNumOfType('file'));

// across all nodes
const addedOrDeletedFiles = computed(() : IAddedOrDeletedFiles => {
  const added:number[] = [];
  const deleted:number[] = [];

  if (!simulateReploymentMode.value) {
    return {
      added,
      deleted,
      empty: true,
    };
  }

  Array.from(fileNodesMap.keys()).forEach(key => {
    const node = fileNodesMap.get(key);
    if (node) {
      if (node.new) {
        added.push(node.key);
      } else if (node.deleted) {
        deleted.push(node.key);
      }
    }
  });

  return {
    added,
    deleted,
    empty: (added.length === 0 && deleted.length === 0)
  };
});

onBeforeMount(() => {
  // Initialize ourselves, as if from the API
  qTreeNodes = convertNodesToData(directoryData);
  // initialize the dependent variables (updated on click action) for our data
  onTick();
});

// Acessiblity may be of concern with TREE... keyboard navigation seems to be unavailable. Can
// submit PRs to help improve...??

function walkQTreeNodes(node: QTreeNode, func: (n: QTreeNode) => unknown) {
  func(node);
  node.children.forEach(child => walkQTreeNodes(child, func));
}

function flipTicked(key: number) {
  if (!ticked.value.includes(key)) {
    ticked.value.push(key);
  } else {
    ticked.value.splice(ticked.value.indexOf(key), 1);
  }
  onTick();
}

function updateEntryPointFileOptions() {
  const options: EntryPointOption[] = [];

  ticked.value.forEach(key => {
    const fileNode = fileNodesMap.get(key);
    if (fileNode?.possibleEntryPoint) {
      options.push({
        label: fileNode.path,
        value: key,
      });
    }
  });
  if (options.length > 1) {
    entryPointOptions.value.splice(0, entryPointOptions.value.length);
    options.sort((a: EntryPointOption, b: EntryPointOption) => {
      if (a.label > b.label) {
        return 1;
      }
      if (a.label < b.label) {
        return -1;
      }
      return 0;
    });
  }
  entryPointOptions.value = options;
  if (options.length === 0) {
    entryPoint.value = null;
    return;
  }
  if (entryPoint?.value) {
    const found = options.find(x => x.value === entryPoint.value?.value);
    if (!found) {
      entryPoint.value = null;
    }
  }
}

function updateDisplayRedeploymentDiffs() {
  // re-convert using current state of simulateRedeploymentMode variable
  qTreeNodes = convertNodesToData(directoryData);
  if (!simulateReploymentMode.value) {
    // remove any ticks for "new" files
    ticked.value = ticked.value.filter(key => {
      const node = qTreeNodesMap.get(key);
      return Boolean(node && !node.new);
    });
  }
  onTick();
}

function updateIgnoreRules() {
  const rules: string[] = [];

  // look for non-checked entries and determine if they need to
  // update the rules or not

  const uncheckedFilePathsButNotFiltered: string[] = [];
  Array.from(fileNodesMap.keys()).forEach(key => {
    const node = fileNodesMap.get(key);
    if (
      node &&
      node.type === 'file' &&
      !ticked.value.includes(key) &&
      !(node.excluded === true) &&
      !(node.deleted === true) &&
      node.path
    ) {
      if (node.new === true && simulateReploymentMode.value) {
        uncheckedFilePathsButNotFiltered.push(node.path);
      } else if (!(node.new === true)) {
        uncheckedFilePathsButNotFiltered.push(node.path);
      }
    }
  });
  const checkedNodesButFiltered: string[] = [];
  ticked.value.forEach(key => {
    const node = fileNodesMap.get(key);
    if (node && node.excluded === true && node.path) {
      checkedNodesButFiltered.push(node.path);
    }
  });

  // exclusion rules first
  SampleIncomingRules.excluding.forEach(path => rules.push(path));
  uncheckedFilePathsButNotFiltered.forEach(path => {
    const entry = `${path}`;
    if (!rules.includes(entry)) {
      rules.push(`${path}`);
    }
  });
  // then inclusion
  SampleIncomingRules.including.forEach(path => rules.push(path));
  checkedNodesButFiltered.forEach(path => {
    rules.push(`!${path}`);
  });

  ignoreRules.value = rules;
}

function toggleNodeTick(n: QTreeNode) {
  if (!n.tickable) {
    return;
  }
  if (nextToggleSelectionStateToTrue) {
    if (!ticked.value.includes(n.key)) {
      ticked.value.push(n.key);
    }
  } else if (ticked.value.includes(n.key)) {
    // untick it
    ticked.value.splice(ticked.value.indexOf(n.key), 1);

    if (!treeEnableExcluded.value) {
      const fileNode = fileNodesMap.get(n.key);
      if (!fileNode?.contents && fileNode?.excluded) {
        n.tickable = Boolean(treeEnableExcluded.value);
        n.showDisabled = !n.tickable;
      }
    }
  }
}

function handleNodeLabelClick(node: QTreeNode) {
  if (!node.children.length) {
    flipTicked(node.key);
    return;
  }

  walkQTreeNodes(node, toggleNodeTick);

  nextToggleSelectionStateToTrue = !nextToggleSelectionStateToTrue;
  onTick();
  forceRefreshOfQTree();
}

function forceRefreshOfQTree() {
  if (fileTree.value) {
    /*  eslint-disable @typescript-eslint/no-explicit-any */
    const qtree: any = fileTree.value;
    // This is a hack to force QTree to re-evaluate changes.
    // Would be very good to find supported way of doing this.
    // Need to determine why this is needed? Did I not make the data
    // reactive????
    qtree.lazy = {};
  }
}

function onTick() {
  updateDisabledQTreeNodes();
  updateEntryPointFileOptions();
  updateIgnoreRules();
}

function updateDisabledQTreeNodes() {
  qTreeNodesMap.forEach((qTreeNode, key) => {
    // if node is already selected, do nothing

    if (ticked.value.includes(key)) {
      return;
    }

    const node = fileNodesMap.get(key);
    if (!node) {
      console.log(`node not found for key: ${key}?`);
      return;
    }
    if (!node.contents && node.excluded) {
      qTreeNode.tickable = Boolean(treeEnableExcluded.value);
      qTreeNode.showDisabled = !qTreeNode.tickable;
    }
  });
  forceRefreshOfQTree();
}

function convertNodesToData(nodes: DirectoryNode[]): QTreeNode[] {
  const result:QTreeNode[] = reactive([]);

  nodes.forEach(node => {
    if (!simulateReploymentMode.value) {
      if (node && (node.deleted || node.new)) {
        return;
      }
    }
    if (acknowledgeDifferences.value) {
      // we can hide the deleted ones now
      if (node && node.deleted) {
        return;
      }
    }
    const data:QTreeNode = reactive({
      label: node.name,
      // type: node.type,
      key: node.key,
      tickable: true,
      // size: node.size,
      // time: node.time
      disabled: false,
      showDisabled: false,
      // Is there a better way to do this?
      children: reactive([]) as QTreeNode[],
      deleted: node.deleted,
      new: node.new
    });
    if (node.key === 0) {
      data.label = node.path;
    }
    if (node.contents) {
      data.children = convertNodesToData(node.contents);
      // data.tickable = false;
    } else if (node.excluded) {
      data.tickable = Boolean(treeEnableExcluded.value);
      data.showDisabled = !data.tickable;
    } else if (node.deleted) {
      data.tickable = false;
      data.showDisabled = true;
    } else if (!ticked.value.includes(node.key)) {
      // node is included and not a directory, so tick it if it is not already ticked
      ticked.value.push(node.key);
    }
    result.push(data); // For the QTree component
    qTreeNodesMap.set(node.key, data);
    fileNodesMap.set(node.key, node); // Build up map of keys to nodes
  });
  return result;
}

function getPathFromKey(key: number): string {
  const node = fileNodesMap.get(key);
  if (node) {
    return node.path ? node.path : `unknown path (key=${key})`;
  }
  return `unknown node/path (key=${key})`;
}

const getNumOfType = (targetType: NodeType) => {
  let count = 0;
  ticked.value.forEach(key => {
    const node = fileNodesMap.get(key);
    if (node && node.type === targetType) {
      count++;
    }
  });
  return count;
};

function showChangedBadges(node: QTreeNode) {
  return (
    simulateReploymentMode.value &&
    qTreeNodeHasChildren(node) &&
    !expanded.value.includes(node.key) &&
    nodeHasHiddenChildrenWithDiffs(node).diffsExist
  );
}

function nodeHasHiddenChildrenWithDiffs(node: QTreeNode) {
  const result = {
    newNodes: false,
    deletedNodes: false,
    diffsExist: false,
  };

  walkQTreeNodes(node, (childNode: QTreeNode) => {
    if (!qTreeNodeHasChildren(childNode)) {
      if (childNode.new) {
        result.newNodes = true;
      } else if (childNode.deleted) {
        result.deletedNodes = true;
      }
    }
  });
  if (result.newNodes || result.deletedNodes) {
    result.diffsExist = true;
  }
  return result;
}

function qTreeNodeHasChildren(node: QTreeNode) {
  return node && node.children.length > 0;
}

function parentAddedOrDeletedFilesDisplayString(key: number) {
  const node = qTreeNodesMap.get(key);
  if (!node) {
    return '';
  }
  if (!qTreeNodeHasChildren(node)) {
    return '';
  }
  const diffs = nodeHasHiddenChildrenWithDiffs(node);
  if (!diffs.diffsExist) {
    return '';
  }
  if (addedOrDeletedFiles.value.empty) {
    return '';
  }

  if (diffs.newNodes && diffs.deletedNodes) {
    return 'Hidden children: file(s) added and deleted!';
  } else if (diffs.newNodes) {
    return 'Hidden children: new file(s) found!';
  } else if (diffs.deletedNodes) {
    return 'Hidden children: previous file(s) deleted!';
  }
}

const calculatedFilesSummary = computed(() => {
  // Report.qmd and 2 other files from baseDir totaling 2.3 MB
  if (ticked.value.length === 0) {
    return 'No files selected';
  }
  let totalSize = 0;
  ticked.value.forEach(key => {
    const node = fileNodesMap.get(key);
    if (node && node.type === 'file') {
      totalSize += node.size;
    }
  });
  let totalSizeStr = `${totalSize} bytes`;
  if (totalSize > 1024 * 1024) {
    totalSizeStr = `${(totalSize / 1024).toFixed(1)} MB`;
  } else if (totalSize > 1024) {
    totalSizeStr = `${(totalSize / 1024).toFixed(1)} KB`;
  }

  const numFiles = ticked.value.length;
  if (entryPoint?.value) {
    const node = fileNodesMap.get(entryPoint.value?.value);
    if (node) {
      if (numFiles === 1) {
        return `${node.name} (${totalSizeStr}) from ${baseDir}`;
      }
      return `${node.name} and ${numFiles - 1} other files from ${baseDir} totaling ${totalSizeStr}`;
    }
  }
  if (numFiles === 1) {
    return `${numFiles} file from ${baseDir} totaling ${totalSizeStr}`;
  }
  return `${numFiles} files from ${baseDir} totaling ${totalSizeStr}`;
});

</script>
