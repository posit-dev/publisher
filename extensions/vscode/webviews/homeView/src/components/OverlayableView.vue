<template>
  <div class="container">
    <div v-if="activateOverlay" class="overlay"></div>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  activateOverlay: boolean;
}>();
</script>

<style lang="scss" scoped>
.container {
  position: relative;
  z-index: 1;
}
.overlay {
  background: var(--dropdown-background);
  position: absolute;
  inset: 0;
  z-index: 3;
  opacity: var(--disabled-opacity);
}
</style>
