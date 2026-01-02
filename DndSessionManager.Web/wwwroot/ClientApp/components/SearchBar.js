import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

export default {
	name: 'SearchBar',
	template: `
		<div class="mb-3">
			<input
				type="text"
				class="form-control"
				:placeholder="$t('handbook.search.placeholder')"
				v-model="searchInput"
				@input="onInput">
		</div>
	`,
	emits: ['search'],
	setup(props, { emit }) {
		const { t } = useI18n()
		const searchInput = ref('')
		let debounceTimer = null

		function onInput() {
			if (debounceTimer) {
				clearTimeout(debounceTimer)
			}

			debounceTimer = setTimeout(() => {
				emit('search', searchInput.value)
			}, 300)
		}

		return { searchInput, onInput, t }
	}
}
