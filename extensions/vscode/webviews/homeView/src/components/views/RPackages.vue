<template>
  <TreeSection
    title="R Packages"
    data-automation="r-packages"
    :actions="rPackageActions"
    :codicon="home.r.active.isAlertActive ? `codicon-alert` : ``"
  >
    <WelcomeView v-if="showWelcomeView">
      <template v-if="home.r.active.isMissingPackageFile">
        <p>
          To deploy R content, you need a package file listing any package
          dependencies, but the file does not exist or is invalid. Use
          'renv::snapshot()' at an R console to create one or edit the current
          configuration file ({{
            home.selectedContentRecord?.configurationName
          }}) to point to an existing valid file.
        </p>
        <vscode-button @click="onScanForPackageRequirements()">
          Scan
        </vscode-button>
      </template>
      <template v-if="!home.r.active.isInProject">
        <p data-automation="r-not-configured">
          This project is not configured to use R. To configure R, add an [r]
          section to your configuration file.
        </p>
      </template>
      <template v-if="home.r.active.isEmptyRequirements">
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
import TreeItem from "src/components/tree/TreeItem.vue";
import TreeSection from "src/components/tree/TreeSection.vue";
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
    !home.r.active.isInProject ||
    home.r.active.isEmptyRequirements ||
    home.r.active.isMissingPackageFile
  );
});
</script>
