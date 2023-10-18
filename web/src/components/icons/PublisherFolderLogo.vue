<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <svg
    id="folder"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    :width="width"
    :height="height"
    x="0px"
    y="0px"
    viewBox="0 0 52 52"
    enable-background="new 0 0 52 52"
    xml:space="preserve"
  >
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M48.3,15.7c0-4-2.2-5.4-5.4-5.4c-3.3,0-17.4,0-19.7,0S20,6.3,15.6,6.3
      c-4.4,0-5.3,0-7.6,0c-5.2,0-4.7,6.5-4.7,6.5c0,3.3,0,21.1,0,23.9C3.3,40,5,43,9.7,43c5.6,0,28.7,0.1,32.9,0.1c3.7,0,5.7-1.3,5.7-5.4
      C48.3,31.2,48.3,19.6,48.3,15.7z M40.6,40c-3.7,0-23.9-0.1-28.8-0.1c-4.4,0-5.2-1.4-5.2-4.8c0-2.8-0.1-20.5,0-22.6s0.5-2.8,2.9-2.8
      c2,0,4.4,0,5.4,0c3.5,0,3.8,3.8,6.9,3.8c0.7,0,16,0,18.9,0s4.2,0.3,4.2,4.1c0,3.3,0,13,0,18.5C44.9,39.8,43.8,40,40.6,40z"
    />
  </svg>
</template>

<script setup lang="ts">

defineProps({
  height: { type: String, required: true },
  width: { type: String, required: true },
});
</script>
