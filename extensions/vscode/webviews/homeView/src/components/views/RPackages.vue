<template>
  <TreeSection
    title="R Packages"
    data-automation="r-packages"
    :actions="rPackageActions"
    :codicon="home.r.active.isAlertActive ? `codicon-alert` : ``"
  >
    <WelcomeView v-if="showWelcomeView">
      <template v-if="missingOrInvalidPackageFile">
        <p>
          To deploy R content, you need a package file listing any package
          dependencies, but the file ({{ rPackageFile }}) is missing, empty or
          invalid.
          <a class="webview-link" role="button" @click="onViewRenvDoc">
            See the renv documentation for more details.</a
          >
        </p>
        <p>
          Set up renv to initialize the environment, install dependencies, and
          create a lockfile.
        </p>
        <vscode-button
          @click="onSetupRenv()"
          :disabled="isSettingUpRenv"
          aria-label="Set Up renv"
        >
          Set Up renv
        </vscode-button>
      </template>
      <template v-if="!home.r.active.isInProject">
        <p data-automation="r-not-configured">
          This project is not configured to use R. To configure R, add an [r]
          section to your configuration file.
        </p>
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

import { computed, ref } from "vue";

import { useHomeStore } from "src/stores/home";
import { useHostConduitService } from "src/HostConduitService";
import { WebviewToHostMessageType } from "../../../../../src/types/messages/webviewToHostMessages";
import { ActionButton } from "../ActionToolbar.vue";
import { isConfigurationError } from "../../../../../src/api";

const home = useHomeStore();

const hostConduit = useHostConduitService();

const isSettingUpRenv = ref(false);

const onRefresh = () => {
  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.REFRESH_R_PACKAGES,
  });
};

const onSetupRenv = () => {
  isSettingUpRenv.value = true;
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

const onViewRenvDoc = () => {
  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.NAVIGATE,
    content: {
      uriPath: "https://rstudio.github.io/renv/articles/renv.html",
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
  return result;
});

const showWelcomeView = computed(() => {
  return (
    !home.r.active.isInProject ||
    home.r.active.isEmptyRequirements ||
    home.r.active.isMissingPackageFile
  );
});

const rPackageFile = computed(() => {
  if (
    home.selectedConfiguration &&
    !isConfigurationError(home.selectedConfiguration)
  ) {
    return (
      home.selectedConfiguration.configuration.r?.packageFile || "renv.lock"
    );
  }
});

const missingOrInvalidPackageFile = computed(() => {
  return (
    home.r.active.isMissingPackageFile || home.r.active.isEmptyRequirements
  );
});
</script>
