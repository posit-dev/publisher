<template>
  <div class="welcome-view">
    <slot />
  </div>
</template>

<script setup lang="ts"></script>

<style lang="scss">
.welcome-view {
  display: flex;
  color: var(--vscode-foreground);
  line-height: 1.4em;
  align-items: center;
  flex-direction: column;
  padding: 0 20px 1em;

  * {
    margin-block-end: 0;
    margin-block-start: 1em;
    margin-inline-end: 0;
    margin-inline-start: 0;
  }

  vscode-button {
    width: 100%;
    max-width: 300px;
  }
}
</style>
