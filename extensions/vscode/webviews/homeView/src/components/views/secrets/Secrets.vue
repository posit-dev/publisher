<template>
  <TreeSection title="Secrets" :actions="sectionActions">
    <template v-if="home.secrets.size">
      <Secret v-for="[name] in home.secrets" :name="name" :key="name" />
    </template>
    <WelcomeView v-else>
      <p>No secrets have been added to the configuration.</p>
    </WelcomeView>
  </TreeSection>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { ActionButton } from "src/components/ActionToolbar.vue";
import TreeSection from "src/components/tree/TreeSection.vue";
import WelcomeView from "src/components/WelcomeView.vue";
import { useHomeStore } from "src/stores/home";
import Secret from "src/components/views/secrets/Secret.vue";

const home = useHomeStore();

const sectionActions = computed<ActionButton[]>(() => [
  {
    label: "Clear Values for all Secrets",
    codicon: "codicon-clear-all",
    fn: () => {
      home.secrets.forEach((_, key) => {
        home.secrets.set(key, undefined);
      });
    },
  },
]);
</script>
