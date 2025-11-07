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
  flex-direction: column;
  padding: 0 20px 1em;

  * {
    margin-block-end: 0;
    margin-block-start: 1em;
    margin-inline-end: 0;
    margin-inline-start: 0;
  }

  vscode-button {
    align-self: center;
    width: 100%;
  }
}
</style>
