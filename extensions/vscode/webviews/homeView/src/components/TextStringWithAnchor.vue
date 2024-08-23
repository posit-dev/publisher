<template>
  <span v-if="activeOption" :class="class">
    {{ messageParts[0] }}
    <a class="webview-link" role="button" @click="onClick()">
      {{ activeOption?.anchorStr }}
    </a>
    {{ messageParts[1] }}
  </span>
  <span v-else :class="class">
    {{ message }}
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  ErrorMessageSplitOption,
  findErrorMessageSplitOption,
} from "../../../../src/utils/errorEnhancer";

defineOptions({
  inheritAttrs: false,
});

const emit = defineEmits<{
  // <eventName>: <expected arguments>
  click: [splitOptionId: number]; // named tuple syntax
}>();

interface Props {
  message: string;
  splitOptions: ErrorMessageSplitOption[];
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  class: "",
});

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
