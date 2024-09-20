<template>
  <div class="count-badge">{{ count }}</div>
</template>

<script setup lang="ts">
defineProps<{
  count: number;
}>();
</script>

<style lang="scss" scoped>
.count-badge {
  background-color: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
  border: 1px solid var(--vscode-badge-foreground);

  border-radius: 11px;
  box-sizing: border-box;
  display: inline-block;
  font-size: 11px;
  font-weight: 400;
  line-height: 11px;
  min-height: 18px;
  min-width: 18px;
  padding: 3px 6px;
  text-align: center;
}
</style>
