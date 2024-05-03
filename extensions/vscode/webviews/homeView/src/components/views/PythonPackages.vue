<template>
  <TreeSection title="Python Packages" :actions="pythonPackageActions">
    <WelcomeView v-if="showWelcomeView">
      <template v-if="showScanWelcomeView">
        <p>
          To deploy Python content, you need a package file listing any package
          dependencies, but the file does not exist. Click Scan to create one
          based on the files in your project and your configuration.
        </p>
        <vscode-button @click="onScanForPackageRequirements()">
          Scan
        </vscode-button>
      </template>
      <template v-if="isNotPythonProject">
        <p>
          This project is not configured to use Python. To configure Python, add
          a [python] section to your configuration file.
        </p>
      </template>
      <template v-if="emptyRequirements">
        <p>
          This project currently has no Python package requirements. If this is
          not accurate, click Scan to update based on the files in your project
          and configuration.
        </p>
        <vscode-button @click="onScanForPackageRequirements()">
          Scan
        </vscode-button>
      </template>
    </WelcomeView>
    <template v-else>
      <TreeItem
        v-for="pkg in home.pythonPackages"
        :key="pkg"
        :title="pkg"
        codicon="codicon-package"
        align-icon-with-twisty
      />
    </template>
  </TreeSection>
</template>

<script setup lang="ts">
import TreeItem from "src/components/TreeItem.vue";
import TreeSection from "src/components/TreeSection.vue";
import WelcomeView from "src/components/WelcomeView.vue";

import { computed } from "vue";

import { useHomeStore } from "src/stores/home";
import { useHostConduitService } from "src/HostConduitService";
import { WebviewToHostMessageType } from "../../../../../src/types/messages/webviewToHostMessages";
import { ActionButton } from "../ActionToolbar.vue";

const home = useHomeStore();

const hostConduit = useHostConduitService();

const onRefresh = () => {
  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.REFRESH_PYTHON_PACKAGES,
  });
};

const onScanForPackageRequirements = () => {
  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.SCAN_PYTHON_PACKAGE_REQUIREMENTS,
  });
};

const onEditRequirementsFile = () => {
  if (!home.pythonPackageFile) {
    return;
  }
  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.VSCODE_OPEN_RELATIVE,
    content: {
      relativePath: home.pythonPackageFile,
    },
  });
};

const pythonPackageActions = computed((): ActionButton[] => {
  const result: ActionButton[] = [];
  // if we have no requirements file, so we can't edit or scan
  if (Boolean(home.pythonPackageFile)) {
    result.push({
      label: "Edit Package Requirements File",
      codicon: "codicon-edit",
      fn: onEditRequirementsFile,
    });
  }
  result.push({
    label: "Refresh Packages",
    codicon: "codicon-refresh",
    fn: onRefresh,
  });
  if (Boolean(home.pythonPackageFile)) {
    result.push({
      label: "Scan For Package Requirements",
      codicon: "codicon-eye",
      fn: onScanForPackageRequirements,
    });
  }
  return result;
});

const showWelcomeView = computed(() => {
  return (
    isNotPythonProject.value ||
    emptyRequirements.value ||
    showScanWelcomeView.value
  );
});

const isNotPythonProject = computed(() => {
  return !home.pythonProject;
});

const emptyRequirements = computed(() => {
  return (
    home.pythonProject &&
    home.pythonPackageFile &&
    home.pythonPackages &&
    home.pythonPackages.length === 0
  );
});

const showScanWelcomeView = computed(() => {
  return home.pythonProject && !home.pythonPackageFile;
});
</script>
