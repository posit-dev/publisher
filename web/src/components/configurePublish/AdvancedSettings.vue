<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <LayoutPanel
    title="Advanced Settings"
  >
    <template #avatar>
      <PublisherAdvancedLogo
        width="40px"
        height="40px"
        :fill="colorToHex(colorStore.activePallete.icon.fill)"
        :stroke="colorToHex(colorStore.activePallete.icon.stroke)"
      />
    </template>
    TODO: Show list of editable settings (and some as read-only)
    based on capabilities of target server.
  </LayoutPanel>
</template>

<script setup lang="ts">
import LayoutPanel from 'src/components/configurePublish/LayoutPanel.vue';
import PublisherAdvancedLogo from 'src/components/icons/PublisherAdvancedLogo.vue';
import { useColorStore } from 'src/stores/color';
import { colorToHex } from 'src/utils/colorValues';

const colorStore = useColorStore();
</script>
