<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <svg
    id="destination"
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
    <g>
      <path
        d="M9.5,43.3V12.4c0-1.7,0.8-2.7,2.1-3.3c1.5-0.7,2.8-1,5.6-1c6.8,0,11.4,3.4,17.9,3.4c3,0,4.7-0.7,5.7-0.7
        c1.2,0,2.2,0.8,2.2,2v18.6c0,1.7-0.8,2.8-2.1,3.4c-1.5,0.7-2.7,1-5.6,1c-6.6,0-11.1-3.4-17.9-3.4c-2.4,0-4,0.6-4.5,0.8v10.2
        c0,0.9-0.8,1.7-1.7,1.7S9.5,44.2,9.5,43.3z M39.5,30.9V14.4c-1.2,0.3-2.7,0.5-4.5,0.5c-6.7,0-11.4-3.4-17.7-3.4
        c-2.6,0-4,0.7-4.3,1.3v16.6c1-0.4,2.6-0.6,4.5-0.6c7.1,0,11.7,3.4,17.7,3.4C37.8,32.2,39.2,31.5,39.5,30.9z"
      />
    </g>
  </svg>
</template>

<script setup lang="ts">

defineProps({
  height: { type: String, required: true },
  width: { type: String, required: true },
});
</script>
