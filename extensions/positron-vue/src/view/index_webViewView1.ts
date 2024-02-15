import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import App from './App.vue'
import { messages } from '../locales'

const i18n = createI18n({
	legacy: false,
	locale: 'en',
	messages
})

const app = createApp(App, { test: true })
app.use(i18n).mount('#app')
