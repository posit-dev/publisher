<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <LayoutPanel
    title="Common Settings"
  >
    <template #avatar>
      <PublisherSettingsLogo
        width="40px"
        height="40px"
        :fill="colorStore.activePallete.icon.fill"
        :stroke="colorStore.activePallete.icon.stroke"
      />
    </template>
    TODO: Common settings, probably off the info panel in dashboard
  </LayoutPanel>
</template>

<script setup lang="ts">
import LayoutPanel from 'src/components/configurePublish/LayoutPanel.vue';
import PublisherSettingsLogo from 'src/components/icons/PublisherSettingsLogo.vue';

import { useColorStore } from 'src/stores/color';

const colorStore = useColorStore();
</script>
