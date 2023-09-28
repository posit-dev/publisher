<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <LayoutPanel
    title="Common Settings"
  >
    <template #avatar>
      <PublisherSettingsLogo
        width="40px"
        height="40px"
        fill="lightgray"
        stroke="none"
      />
    </template>
    TODO: Common settings, probably off the info panel in dashboard
  </LayoutPanel>
</template>

<script setup lang="ts">
import LayoutPanel from 'src/components/configurePublish/LayoutPanel.vue';
import PublisherSettingsLogo from 'src/components/icons/PublisherSettingsLogo.vue';
</script>

