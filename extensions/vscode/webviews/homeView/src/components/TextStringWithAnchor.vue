<template>
  <span v-if="activeOption" :class="$attrs.class">
    {{ messageParts[0] }}
    <a class="webview-link" role="button" @click="onClick()">
      {{ activeOption?.anchorStr }}
    </a>
    {{ messageParts[1] }}
  </span>
  <span v-else :class="$attrs.class">
    {{ message }}
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  ErrorMessageSplitOption,
  findErrorMessageSplitOption,
} from "../../../../src/utils/errorEnhancer";

const emit = defineEmits<{
  // <eventName>: <expected arguments>
  click: [splitOptionId: number]; // named tuple syntax
}>();

interface Props {
  message: string;
  splitOptions: ErrorMessageSplitOption[];
}

const props = defineProps<Props>();

const activeOption = computed(() => {
  return findErrorMessageSplitOption(props.message);
});

const messageParts = computed(() => {
  if (activeOption.value !== undefined && activeOption.value.anchorStr) {
    const parts = props.message.split(activeOption.value.anchorStr);
    if (parts.length === 2) {
      return parts;
    }
  }
  return ["", ""];
});

const onClick = () => {
  if (activeOption.value) {
    emit("click", activeOption.value.actionId);
  }
};
</script>
