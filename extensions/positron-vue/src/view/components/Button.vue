<template>
  <div class="flex mt-4 gap-4 items-center w-full">
    <p class="w-1/2">
      Times clicked: {{ count }}
    </p>
    <button
      class="w-1/2"
      @click="increment"
    >
      Increment
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

let count = ref(0)

const increment = () => {
	count.value++
}
</script>
