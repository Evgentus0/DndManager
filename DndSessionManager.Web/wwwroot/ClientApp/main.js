import { createApp } from 'vue'
import { i18n } from './i18n.js'
import { createPinia } from 'pinia'

// Export for use in individual page apps
export { i18n, createPinia }

// Main app initialization will happen in individual page scripts
