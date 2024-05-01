<template>
  <TreeSection title="Python Packages" :actions="pythonPackageActions">
    <WelcomeView v-if="showWelcomeView">
      <p>
        To deploy Python content, you need a package file listing any package
        dependencies. Click Scan to create or update one based on the files in
        your project and your configuration.
      </p>
      <vscode-button @click="onScanForPackageRequirements()">
        Scan
      </vscode-button>
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

const pythonPackageActions = computed(() => {
  const result = [];
  if (showEditRequirementsFile.value) {
    result.push({
      label: "Edit Package Requirements File",
      codicon: "codicon-edit",
      fn: onEditRequirementsFile,
    });
  }
  result.push(
    {
      label: "Refresh Packages",
      codicon: "codicon-refresh",
      fn: onRefresh,
    },
    {
      label: "Scan For Package Requirements",
      codicon: "codicon-eye",
      fn: onScanForPackageRequirements,
    },
  );
  return result;
});

const showEditRequirementsFile = computed(() => {
  return Boolean(home.pythonPackageFile);
});

const showWelcomeView = computed(() => {
  return !home.pythonPackages || home.pythonPackages.length === 0;
});
</script>
