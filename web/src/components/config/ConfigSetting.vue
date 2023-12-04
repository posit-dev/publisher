<template>
  <div>
    <dt>{{ label }}</dt>
    <dd>
      <slot />
    </dd>
  </div>
</template>

<script setup lang="ts">
defineProps({
  label: {
    type: String,
    required: true,
  },
});
</script>
