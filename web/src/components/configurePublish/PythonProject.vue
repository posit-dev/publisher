<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <LayoutPanel
    title="Python"
  >
    <template #avatar>
      <PublisherPythonLogo
        width="40px"
        height="40px"
        :fill="colorStore.activePallete.icon.fill"
        :stroke="colorStore.activePallete.icon.stroke"
      />
    </template>
    TODO: Show detailed python version and list of package dependencies
    with ability to add or remove package dependencies.
  </LayoutPanel>
</template>

<script setup lang="ts">
import LayoutPanel from 'src/components/configurePublish/LayoutPanel.vue';
import PublisherPythonLogo from 'src/components/icons/PublisherPythonLogo.vue';

import { useColorStore } from 'src/stores/color';

const colorStore = useColorStore();
</script>

