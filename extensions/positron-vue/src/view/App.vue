<template>
  <div class="flex items-center flex-col w-3/4 mx-auto">
    <h1 class="text-lg">
      Publisher Custom WebViewView
    </h1>

    <hr class="border-white w-full mt-4 mb-8">
    Prop: {{ test }}

    <div class="flex gap-4">
      <label>{{ t('language') }}</label>
      <select
        v-model="locale"
        class="text-black"
      >
        <option value="en">
          en
        </option>
        <option value="ja">
          ja
        </option>
        <option value="fr">
          fr
        </option>
      </select>
    </div>
    <p>Translated Content: {{ t('hello') }}</p>

    <Button />

    <p class="mt-4 mb-2">
      Current File: {{ currentFile }}
    </p>
    <button
      @click="openLastFile"
    >
      Open Last File
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from './components/Button.vue'

const { t, locale } = useI18n()

let currentFile = ref('')
let lastFile = ref('')

defineProps({
  test: {
    type: Boolean,
    required: true,
  },
});

// Example of handling messages sent from the extension to the webview
window.addEventListener('message', (event) => {
	const message = event.data // The JSON data our extension sent

	switch (message.command) {
	case 'setCurrentFileExample':
		lastFile.value = currentFile.value
		currentFile.value = message.text
		return
	}
})

// Example of sending a message from the webview to the extension
const openLastFile = () => {
	vscode.postMessage({
		command: 'openFileExample',
		text: lastFile.value
	})
}
</script>
