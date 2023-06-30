<template>
  <q-layout
    view="hHh lpR fFf"
    class="q-pa-md bg-grey-9 text-white"
    style="max-width: 800px"
  >
    <q-header
      elevated
      class="bg-primary text-white"
    >
      <q-toolbar>
        <q-toolbar-title>
          <img
            src="/assets/images/posit-logo-reverse-TM.svg"
            style="
              width: 100px;
              vertical-align: middle;
            "
            alt="Posit PBC logo"
          >
          Publisher
        </q-toolbar-title>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <h6 style="margin-top: 0rem; margin-bottom: 1rem;">
        What would you like to be published and how?
      </h6>
      <q-list
        dark
        bordered
        class="rounded-borders"
      >
        <q-expansion-item>
          <template #header>
            <q-item-section avatar>
              <q-icon
                name="img:assets/images/posit-logo-only-unofficial.svg"
                size="35px"
              />
            </q-item-section>

            <q-item-section>
              <q-item-label>Destination</q-item-label>
              <q-item-label caption>
                {{ destinationTitle }}
              </q-item-label>
            </q-item-section>
          </template>

          <q-card class="bg-grey-9">
            <q-card-section>
              <div class="q-pa-xs row q-col-gutter-sm">
                <q-checkbox
                  v-model="simulateRedeploymentMode"
                  label="Simulate redeployment view"
                  left-label
                  dark
                />
              </div>
              TODO: select from previous deployments or add to existing or new targets<br>
              <br>
              User selects from a list of deployment targets:<br>
              <ul>
                <li>Update an existing deployment</li>
                <li>New deployment on an existing account</li>
                <li>Create a new account</li>
              </ul>
              <br>
              Scenarios:<br>
              <ul>
                <li>Redeployment of bundle to previous destination</li>
                <li>Modification of files include in bundle to previous destination</li>
                <li>Content type changed since last deployment</li>
                <li>New deployment of bundle w/ same settings as before but to new destination (server or account)</li>
                <li>Redeployment of bundle w/ changed settings</li>
                <li>New deployment - existing destination/account</li>
                <li>New deployment - existing destination, different account than used previously</li>
                <li>New deployment - new destination (new account)</li>
              </ul>
<br>
              What would you like to deploy:<br>
              <ul>
                <li>defaults to previous deployment for this bundle</li>
                <li>if content type has changed, it will show as a new deployment</li>
                <li>files included by subdirectory except for exclusions</li>
              </ul>
            </q-card-section>
          </q-card>
        </q-expansion-item>

        <q-separator />

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
                  v-model="treeEnableExcluded"
                  label="Allow Selection of Disabled/Filtered Files"
                  left-label
                  dark
                  @click="updateDisabledQTreeNodes"
                />
              </div>
              <div
                v-if="simulateRedeploymentMode"
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
                  :nodes="qTreeNodes as any"
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
                      @click.stop.prevent="entryPoint = (null as unknown) as QSelectOption"
                    />
                  </template>
                </q-select>
              </div>
              <div class="q-pa-md row q-col-gutter-sm">
                <div class="col-12 col-sm-6 q-gutter-sm">
                  <div class="text-h6 q-mb-md q-mr-lg">
                    Selected {{ getNumDirs }} directories and {{ getNumFiles }} files
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

        <q-separator />

        <q-expansion-item>
          <template #header>
            <q-item-section avatar>
              <q-icon
                name="img:assets/images/python-logo-only.svg"
                size="35px"
              />
            </q-item-section>

            <q-item-section>
              <q-item-label>Python</q-item-label>
              <q-item-label caption>
                Python 3.11 and 18 package dependencies
              </q-item-label>
            </q-item-section>
          </template>

          <q-card class="bg-grey-9">
            <q-card-section>
              TODO: Show detailed python version and list of package dependencies
              with ability to add or remove package dependencies. <br><br>
              QUESTON: Do we allow them to change the target python version?
            </q-card-section>
          </q-card>
        </q-expansion-item>

        <q-separator />

        <q-expansion-item>
          <template #header>
            <q-item-section avatar>
              <q-icon
                name="img:assets/images/info.png"
                size="35px"
              />
            </q-item-section>

            <q-item-section>
              <q-item-label>Common Settings</q-item-label>
              <q-item-label caption>
                Description and graphic have been set.
              </q-item-label>
            </q-item-section>
          </template>

          <q-card class="bg-grey-9">
            <q-card-section>
              TODO: Common settings, probably off the info panel in dashboard
            </q-card-section>
          </q-card>
        </q-expansion-item>

        <q-separator />

        <q-expansion-item>
          <template #header>
            <q-item-section avatar>
              <q-icon
                name="img:assets/images/settings.png"
                size="35px"
              />
            </q-item-section>

            <q-item-section>
              <q-item-label>Advanced Settings</q-item-label>
              <q-item-label caption>
                Using defaults...
              </q-item-label>
            </q-item-section>
          </template>

          <q-card class="bg-grey-9">
            <q-card-section>
              TODO: Show list of editable settings (and some as read-only)
              based on capabilities of target server. <br><br>
              QUESTION: Do we save updated settings when server target changes
              and the capabilities no longer allow the setting? (We save so that
              we can restore back?)
            </q-card-section>
          </q-card>
        </q-expansion-item>
      </q-list>
      <q-linear-progress
        v-if="showProgressBar"
        stripe
        rounded
        size="20px"
        :value="progressValue"
        color="primary"
        class="q-mt-sm"
      />
      <div class="q-mt-sm fit row wrap justify-end items-start content-start">
        <q-btn
          v-if="showDetailsButton"
          class="q-mt-sm q-ml-sm"
          color="primary"
          label="Details..."
          @click="toggleShowTimeline"
        />
        <q-btn
          :disabled="disablePublishButton"
          class="q-mt-sm q-ml-sm"
          color="primary"
          label="Publish"
          @click="onClickPublish"
        />
      </div>
      <q-timeline
        v-if="showTimeline"
        color="secondary"
        class="text-body3"
      >
        <q-timeline-entry
          heading
          class="text-body2"
          style="font-size: 0.75rem !important;"
        >
          Deployment Timeline
        </q-timeline-entry>

        <q-timeline-entry
          v-for="step in deploymentSteps"
          :key="step.type"
          :title="step.type"
          side="left"
          class="text-body2"
          avatar="https://cdn.quasar.dev/logo-v2/svg/logo.svg"
        >
          <q-expansion-item>
            <template #header>
              <q-item-section>
                <q-item-label>Success - {{ step.log.length }} lines</q-item-label>
              </q-item-section>
            </template>
            <div class="terminal-container">
              <div
                v-for="row, ndx in step.log"
                :key="ndx"
                class="terminal"
              >
                {{ row }}
              </div>
            </div>
          </q-expansion-item>
        </q-timeline-entry>
      </q-timeline>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">

import { ref, watch, reactive, computed } from 'vue';

import type { NodeType, DirectoryNode } from '../api/directoryContents';
import { directoryData, SampleIncomingRules, baseDir } from '../api/directoryContents';

import { deploymentSteps } from './deploymentSteps';

const showDetailsButton = ref(false);
const showTimeline = ref(false);
const showProgressBar = ref(false);
const disablePublishButton = ref(false);
const progressValue = ref(0);

function toggleShowDetailsButton() {
  showDetailsButton.value = !showDetailsButton.value;
}

function toggleShowProgressBar() {
  showProgressBar.value = !showProgressBar.value;

  if (showProgressBar.value) {
    progressValue.value = 0;
    const interval = setInterval(() => {
      progressValue.value += 0.1;
      console.log(progressValue.value);
      if (progressValue.value > 1) {
        progressValue.value = 1;
        clearInterval(interval);
      }
    });
  }
}

function toggleShowTimeline() {
  showTimeline.value = !showTimeline.value;
}

function onClickPublish() {
  toggleShowProgressBar();
  toggleShowDetailsButton();
}

const selected = ref('');
const ticked = ref([] as number[]);
const expanded = ref([0] as number[]);
const ignoreRules = ref([] as string[]);
const treeEnableExcluded = ref(false);
const simulateRedeploymentMode = ref(false);
const filesExpanded = ref(false);
const acknowledgeDifferences = ref(false);

watch(simulateRedeploymentMode, () => {
  updateDisplayRedeploymentDiffs();
});

watch(acknowledgeDifferences, () => {
  qTreeNodes = convertNodesToData(directoryData);
  onTick();
});

const destinationTitle = computed(() => {
  if (simulateRedeploymentMode.value) {
    return `Colorado, updating 'Quarterly Report'`;
  }
  return `Colorado, deploying 'Quarterly Report'`;
})

type QSelectOption = {
  label: string;
  key: number;
}
const entryPoint = ref((null as unknown) as QSelectOption);
const entryPointOptions = ref([] as QSelectOption[]);

let nextToggleSelectionStateToTrue = true;

// The following line establishes a component ref in $refs that we can work with
const fileTree = ref(null);

const fileNodesMap = reactive(new Map<number, DirectoryNode>());
const qTreeNodesMap = reactive(new Map<number, QTreeNode>());

// Acessiblity may be of concern with TREE... keyboard navigation seems to be unavailable. Can
// submit PRs to help improve...??

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
  const options = [] as QSelectOption[];

  ticked.value.forEach(key => {
    const fileNode = fileNodesMap.get(key);
    if (fileNode?.possibleEntryPoint) {
      options.push({
        label: fileNode.path,
        key,
      } as QSelectOption);
    }
  });
  if (options.length > 1) {
    entryPointOptions.value.splice(0, entryPointOptions.value.length);
    options.sort((a: QSelectOption, b: QSelectOption) => {
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
    entryPoint.value = (null as unknown) as QSelectOption;
    return;
  }
  if (entryPoint.value) {
    const found = options.find(x => x.key === entryPoint.value.key);
    if (!found) {
      entryPoint.value = (null as unknown) as QSelectOption;
    }
  }
}

function updateDisplayRedeploymentDiffs() {
  // re-convert using current state of simulateRedeploymentMode variable
  qTreeNodes = convertNodesToData(directoryData);
  if (simulateRedeploymentMode.value === false) {
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
      if (node.new === true && simulateRedeploymentMode.value) {
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
    const qtree = fileTree.value as any;
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
    if (!simulateRedeploymentMode.value) {
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
let qTreeNodes = convertNodesToData(directoryData);
// initialize the dependent variables (updated on click action) for our data
onTick();

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

const getNumDirs = computed(() => getNumOfType('directory'));

const getNumFiles = computed(() => getNumOfType('file'));

// across all nodes
const addedOrDeletedFilesDisplayString = computed((): string | null => {
  if (addedOrDeletedFiles.value?.empty || !simulateRedeploymentMode.value) {
    return null;
  }

  if (addedOrDeletedFiles.value) {
    const { added, deleted } = addedOrDeletedFiles.value;

    if (added.length > 0 && deleted.length > 0) {
      return 'file(s) added and deleted!';
    } else if (added.length > 0) {
      return 'new file(s) found!';
    } else if (deleted.length > 0) {
      return 'previous file(s) deleted!';
    }
  }

  return null;
});

interface IAddedOrDeletedFiles {
  added: number[];
  deleted: number[];
  empty: boolean;
}

// across all nodes
const addedOrDeletedFiles = computed(() : IAddedOrDeletedFiles => {
  const added:number[] = [];
  const deleted:number[] = [];

  if (!simulateRedeploymentMode.value) {
    return {
      added,
      deleted,
      empty: true,
    } as IAddedOrDeletedFiles;
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
  } as IAddedOrDeletedFiles;
});

function showChangedBadges(node: QTreeNode) {
  return (
    simulateRedeploymentMode.value &&
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
  if (entryPoint.value) {
    const node = fileNodesMap.get(entryPoint.value.key);
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

const deepKeysOfChildren = (parentKey:number, childrenKeys:number[]) => {
  const node = fileNodesMap.get(parentKey);
  if (node) {
    if (node.childrenKeys) {
      node.childrenKeys.forEach((key:number) => {
        childrenKeys.push(key);
        deepKeysOfChildren(key, childrenKeys);
      });
    }
  }
};

</script>

<style>
.q-timeline__heading-title {
  font-size: 1rem;
  padding: unset;
}
.q-timeline__title {
  font-size: 1rem;
  margin-bottom: 8px;
}
.terminal-container {
  margin-left: 1rem;
  padding: 1rem;
  background-color: darkgray;
  color: black;
}
.terminal {
  max-width: 100%;
  font-size: 0.75rem;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}
</style>
