<template>
  <span class="post-decor">
    <slot />
  </span>
</template>

<script setup lang="ts"></script>

<style lang="scss" scoped>
.post-decor {
  font-size: 90%;
  font-weight: 600;
  margin: auto 3px 0 5px;
  opacity: 0.75;
  text-align: center;
  line-height: 22px;
}
</style>
