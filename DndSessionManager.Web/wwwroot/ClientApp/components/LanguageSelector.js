import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

export default {
	name: 'LanguageSelector',
	template: `
	<div class="dropdown">
		<button class="btn btn-outline-light dropdown-toggle"
				type="button"
				id="languageDropdown"
				data-bs-toggle="dropdown"
				aria-expanded="false">
			{{ currentLanguageLabel }}
		</button>
		<ul class="dropdown-menu dropdown-menu-end" aria-labelledby="languageDropdown">
			<li>
			<a class="dropdown-item"
				:class="{ active: locale === 'en' }"
				href="#"
				@click.prevent="changeLanguage('en')">
				English
			</a>
			</li>
			<li>
			<a class="dropdown-item"
				:class="{ active: locale === 'ru' }"
				href="#"
				@click.prevent="changeLanguage('ru')">
				Русский
			</a>
			</li>
		</ul>
	</div>
	`,
	setup () {
		const { locale } = useI18n()

		const currentLanguageLabel = computed(() => {
			return locale.value === 'en' ? 'English' : 'Русский'
		})

		function changeLanguage(lang) {
			locale.value = lang
			localStorage.setItem('user-language', lang)
			// Reload page to update all text
			window.location.reload()
		}

		return { locale, currentLanguageLabel, changeLanguage }
	}
}
