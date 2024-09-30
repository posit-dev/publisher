<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <EntryMissing
    v-if="ifEntryMissingError"
    :config-selection-prompt="promptForConfigSelection"
    @select-configuration="selectConfiguration"
  />
  <FileMissing
    v-if="ifFileMissingError"
    :config-selection-prompt="promptForConfigSelection"
    @select-configuration="selectConfiguration"
  />
  <InvalidTOMLFile
    v-if="ifInvalidTOMLFileError"
    :error="invalidTOMLFileError"
    @edit-active-configuration="onEditActiveConfiguration"
  />
  <UnhandledError v-if="ifUnhandledError" :error="configError" />
</template>
<script setup lang="ts">
import { useHostConduitService } from "src/HostConduitService";
import { useHomeStore } from "src/stores/home";
import { computed } from "vue";
import { WebviewToHostMessageType } from "../../../../../src/types/messages/webviewToHostMessages";
import { isConfigurationError } from "../../../../../src/api";
import {
  AgentError,
  InvalidTOMLFileCodeError,
  isInvalidTOMLFileCode,
} from "../../../../../src/api/types/error";

import InvalidTOMLFile from "./InvalidTOMLFile.vue";
import EntryMissing from "./EntryMissing.vue";
import FileMissing from "./FileMissing.vue";
import UnhandledError from "./UnhandledError.vue";

const home = useHomeStore();
const hostConduit = useHostConduitService();

const ifEntryMissingError = computed(() => {
  return home.config.active.isEntryMissing;
});

const ifFileMissingError = computed(() => {
  return home.config.active.isMissing;
});

const ifInvalidTOMLFileError = computed(() => {
  return invalidTOMLFileError.value;
});

const ifUnhandledError = computed(() => {
  return (
    !ifEntryMissingError.value &&
    !ifFileMissingError.value &&
    !ifInvalidTOMLFileError.value
  );
});

const invalidTOMLFileError = computed(
  (): InvalidTOMLFileCodeError | undefined => {
    if (configError.value && isInvalidTOMLFileCode(configError.value)) {
      return configError.value;
    }
    return undefined;
  },
);

const promptForConfigSelection = computed((): string => {
  return home.config.active.matchingConfigs.length > 0
    ? "Select a Configuration"
    : "Create a Configuration";
});

const onEditActiveConfiguration = () => {
  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.EDIT_CONFIGURATION,
    content: {
      configurationPath: home.selectedConfiguration!.configurationPath,
    },
  });
};

const selectConfiguration = () => {
  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.SHOW_SELECT_CONFIGURATION,
  });
};

const configError = computed((): AgentError | undefined => {
  if (
    home.selectedConfiguration &&
    isConfigurationError(home.selectedConfiguration)
  ) {
    return home.selectedConfiguration.error;
  }
  return undefined;
});
</script>
