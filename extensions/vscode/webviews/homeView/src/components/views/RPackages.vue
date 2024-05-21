<template>
  <TreeSection title="R Packages" :actions="rPackageActions">
    <WelcomeView v-if="showWelcomeView">
      <template v-if="showScanWelcomeView">
        <p>
          To deploy R content, you need a package file listing any package
          dependencies, but the file does not exist or is invalid. Use
          'renv::snapshot()' at an R console to create one or edit the current
          configuration file ({{ home.selectedDeployment?.configurationName }})
          to point to an existing valid file.
        </p>
        <vscode-button @click="onScanForPackageRequirements()">
          Scan
        </vscode-button>
      </template>
      <template v-if="isNotRProject">
        <p>
          This project is not configured to use R. To configure R, add an [r]
          section to your configuration file.
        </p>
      </template>
      <template v-if="emptyRequirements">
        <p>
          This project currently has no R package requirements (file ({{
            home.rPackageFile
          }}) is either missing, empty or invalid).
        </p>
        <vscode-button @click="onScanForPackageRequirements()">
          Scan
        </vscode-button>
      </template>
    </WelcomeView>
    <template v-else>
      <TreeItem
        v-for="pkg in home.rPackages"
        :key="pkg.package"
        :title="pkg.package"
        :description="pkg.version"
        :tooltip="pkg.source + ': ' + pkg.repository"
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
    kind: WebviewToHostMessageType.REFRESH_R_PACKAGES,
  });
};

const onScanForPackageRequirements = () => {
  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.SCAN_R_PACKAGE_REQUIREMENTS,
  });
};

const onEditRequirementsFile = () => {
  if (!home.rPackageFile) {
    return;
  }
  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.VSCODE_OPEN_RELATIVE,
    content: {
      relativePath: home.rPackageFile,
    },
  });
};

const rPackageActions = computed((): ActionButton[] => {
  const result: ActionButton[] = [];
  // if we have no requirements file, so we can't edit or scan
  if (Boolean(home.rPackageFile)) {
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
  if (Boolean(home.rPackageFile)) {
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
    isNotRProject.value || emptyRequirements.value || showScanWelcomeView.value
  );
});

const isNotRProject = computed(() => {
  return !home.rProject;
});

const emptyRequirements = computed(() => {
  return (
    home.rProject &&
    home.rPackageFile &&
    home.rPackages &&
    home.rPackages.length === 0
  );
});

const showScanWelcomeView = computed(() => {
  return home.rProject && !home.rPackageFile;
});
</script>
