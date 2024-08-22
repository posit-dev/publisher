<template>
  <TreeSection title="Help and Feedback">
    <TreeItem
      title="Get Started with Posit Publisher"
      tooltip="Open Getting Started Documentation"
      align-icon-with-twisty
      @click="
        hostConduit.sendMsg({
          kind: WebviewToHostMessageType.NAVIGATE,
          content: {
            uriPath:
              'https://github.com/posit-dev/publisher/blob/main/docs/index.md',
          },
        })
      "
    />
    <TreeItem
      title="Provide Feedback"
      tooltip="Open GitHub Discussions"
      align-icon-with-twisty
      @click="
        hostConduit.sendMsg({
          kind: WebviewToHostMessageType.NAVIGATE,
          content: {
            uriPath: 'https://github.com/posit-dev/publisher/discussions',
          },
        })
      "
    />
  </TreeSection>
</template>

<script setup lang="ts">
import TreeSection from "src/components/tree/TreeSection.vue";
import TreeItem from "src/components/tree/TreeItem.vue";
import { useHostConduitService } from "src/HostConduitService";

import { WebviewToHostMessageType } from "../../../../../src/types/messages/webviewToHostMessages";

const hostConduit = useHostConduitService();
</script>
