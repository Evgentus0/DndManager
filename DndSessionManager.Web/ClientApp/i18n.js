import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import ru from './locales/ru.json'

// Get saved language or use browser default
const savedLanguage = localStorage.getItem('user-language')
const browserLanguage = navigator.language.split('-')[0] // 'en', 'ru', etc.
const defaultLanguage = savedLanguage || (browserLanguage === 'ru' ? 'ru' : 'en')

const i18n = createI18n({
  legacy: false, // Use Composition API mode
  locale: defaultLanguage,
  fallbackLocale: 'en',
  messages: {
    en,
    ru
  }
})

export default i18n
