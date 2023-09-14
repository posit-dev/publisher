<!-- Copyright (C) 2023 by Posit Software, PBC. -->
<template>
  <div
    class="q-my-lg row justify-between"
    style="align-items: flex-start;"
  >
    <q-input
      v-if="showTitle"
      v-model="title"
      label="Title"
      outlined
      dense
      dark
      clearable
      hint="Enter a title for your content on the server"
      style="min-width: 75%"
    />
    <q-btn
      :disable="disablePublishingAction"
      color="primary"
      label="Publish"
      @click="onPublish"
      padding="8px 30px"
      class="q-ml-xs"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  showTitle: boolean
}>();

const emit = defineEmits(['publish']);

const title = ref('fastapi-simple');

const disablePublishingAction = ref(false);

const onPublish = async() => {
  emit('publish');
  disablePublishingAction.value = true;
  try {
    // await api.publish.start();
  } catch (e) {
    // Temporary until we determine the mechanism to notify users of general errors.
    console.log('An error has occurred when calling publish.start:', e);
  }
  disablePublishingAction.value = false;
};

</script>
