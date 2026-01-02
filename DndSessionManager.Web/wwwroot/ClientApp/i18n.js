import { createI18n } from 'vue-i18n'

async function loadMessages() {
	const [en, ru] = await Promise.all([
		fetch('/ClientApp/locales/en.json').then(r => r.json()),
		fetch('/ClientApp/locales/ru.json').then(r => r.json())
	])

	return { en, ru }
}

const savedLanguage = localStorage.getItem('user-language')
const browserLanguage = navigator.language.split('-')[0]
const defaultLanguage = savedLanguage || (browserLanguage === 'ru' ? 'ru' : 'en')

const messages = await loadMessages()

const i18n = createI18n({
	legacy: false,
	locale: defaultLanguage,
	fallbackLocale: 'en',
	messages
})

export { i18n }
