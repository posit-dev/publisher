<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-page
    class="max-width-md q-mx-auto"
    padding
    dark
  >
    <div>
      <q-btn
        color="primary"
        icon="arrow_back"
        label="Back"
        @click="onBackButton"
      />
    </div>
  </q-page>
</template>

<script setup lang="ts">

const emit = defineEmits(['back']);

const onBackButton = () => {
  emit('back');
};

</script>
