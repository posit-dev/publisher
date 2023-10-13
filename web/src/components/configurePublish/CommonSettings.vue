<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <LayoutPanel
    title="Common Settings"
  >
    <template #avatar>
      <PublisherSettingsLogo
        width="40px"
        height="40px"
        svg-class="common-logo"
      />
    </template>
    TODO: Common settings, probably off the info panel in dashboard
  </LayoutPanel>
</template>

<script setup lang="ts">
import LayoutPanel from 'src/components/configurePublish/LayoutPanel.vue';
import PublisherSettingsLogo from 'src/components/icons/PublisherSettingsLogo.vue';

import { useColorStore } from 'src/stores/color';
import { colorToHex } from 'src/utils/colorValues';

const colorStore = useColorStore();
</script>

<style>
.common-logo {
  fill: v-bind('colorToHex(colorStore.activePallete.icon.fill)');
  stroke: v-bind('colorToHex(colorStore.activePallete.icon.stroke)');
}
</style>
