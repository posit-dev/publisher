<template>
  <div class="pane" :class="{ expanded: expanded }">
    <div
      class="pane-header"
      :class="{ expanded: expanded }"
      @click="expanded = !expanded"
    >
      <div
        class="twisty-container codicon"
        :class="expanded ? 'codicon-chevron-down' : 'codicon-chevron-right'"
      />
      <h3 class="title">{{ title }}</h3>
    </div>
    <div v-if="expanded" class="pane-body">
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Nemo ad adipisci
      veniam rerum id dicta quos voluptatum ab voluptatem quibusdam hic totam,
      voluptate reiciendis odit consequatur iste blanditiis harum error! Lorem
      ipsum dolor sit amet consectetur adipisicing elit. Autem, veritatis!
      Quidem sequi reiciendis reprehenderit at, iure blanditiis veritatis quod
      amet eveniet sed officia accusamus vel enim tempora. Enim, eligendi ipsa.
    </div>
  </div>
</template>

<script setup lang="ts">
const expanded = defineModel("expanded", { required: false, default: false });

defineProps<{
  title: string;
}>();
</script>

<style lang="scss" scoped>
.pane-header {
  line-height: 22px;
  color: var(--vscode-sideBarSectionHeader-foreground);
  background-color: var(--vscode-sideBarSectionHeader-background);
  border-top: 1px solid var(--vscode-sideBarSectionHeader-border);
  position: relative;
  align-items: center;
  cursor: pointer;
  display: flex;
  font-size: 11px;
  font-weight: 700;
  height: 22px;
  overflow: hidden;

  .twisty-container {
    margin: 0 2px;
    font-size: 16px;
    color: var(--vscode-icon-foreground);
  }
}

.pane-body {
  flex: 1;
  overflow: hidden;
}

.title {
  font-size: 11px;
  min-width: 3ch;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
  -webkit-margin-before: 0;
  -webkit-margin-after: 0;
}
</style>
