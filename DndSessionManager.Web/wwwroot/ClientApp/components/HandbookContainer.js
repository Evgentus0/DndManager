import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import TabNavigation from './TabNavigation.js'
import SearchBar from './SearchBar.js'
import EntityList from './EntityList.js'
import EntityDetail from './EntityDetail.js'

export default {
	name: 'HandbookContainer',
	components: {
		TabNavigation,
		SearchBar,
		EntityList,
		EntityDetail
	},
	template: `
		<div class="container-fluid py-4">
			<h1 class="mb-4">{{ $t('handbook.title') }}</h1>

			<div v-if="viewMode === 'list'">
				<tab-navigation
					:current-tab="currentCategory"
					@tab-changed="handleTabChange">
				</tab-navigation>

				<search-bar @search="handleSearch"></search-bar>

				<entity-list
					:category="categoryMapping[currentCategory]"
					:search-query="searchQuery"
					@view-entity="handleViewEntity"
					@navigate="handleCrossRefNavigate">
				</entity-list>
			</div>

			<div v-else-if="viewMode === 'detail'">
				<entity-detail
					:category="categoryMapping[currentCategory]"
					:entity-index="currentEntityIndex"
					@back="handleBackToList"
					@navigate="handleCrossRefNavigate">
				</entity-detail>
			</div>
		</div>
	`,
	setup() {
		const { t } = useI18n()
		const currentCategory = ref('spells')
		const searchQuery = ref('')
		const viewMode = ref('list') // 'list' or 'detail'
		const currentEntityIndex = ref('')

		// Map display category names to API category names
		const categoryMapping = {
			spells: 'spells',
			monsters: 'monsters',
			classes: 'classes',
			subclasses: 'subclasses',
			equipment: 'equipment',
			magicItems: 'magic-items',
			features: 'features',
			races: 'races',
			traits: 'traits',
			languages: 'languages',
			conditions: 'conditions',
			skills: 'skills',
			abilityScores: 'ability-scores',
			damageTypes: 'damage-types',
			magicSchools: 'magic-schools'
		}

		// Reverse mapping for URL params
		const reverseCategoryMapping = Object.fromEntries(
			Object.entries(categoryMapping).map(([k, v]) => [v, k])
		)

		function handleTabChange(newCategory) {
			currentCategory.value = newCategory
			searchQuery.value = ''
			viewMode.value = 'list'
			currentEntityIndex.value = ''
			updateUrl()
		}

		function handleSearch(query) {
			searchQuery.value = query
		}

		function handleViewEntity(index) {
			currentEntityIndex.value = index
			viewMode.value = 'detail'
			updateUrl()
		}

		function handleBackToList() {
			viewMode.value = 'list'
			currentEntityIndex.value = ''
			updateUrl()
		}

		function handleCrossRefNavigate({ category, index }) {
			// Map API category to display category
			const displayCategory = reverseCategoryMapping[category] || category

			if (categoryMapping[displayCategory]) {
				currentCategory.value = displayCategory
				currentEntityIndex.value = index
				viewMode.value = 'detail'
				updateUrl()
			}
		}

		function updateUrl() {
			const params = new URLSearchParams()
			params.set('category', currentCategory.value)

			if (viewMode.value === 'detail' && currentEntityIndex.value) {
				params.set('index', currentEntityIndex.value)
			}

			const url = `/Handbook/Index?${params.toString()}`
			window.history.pushState({
				category: currentCategory.value,
				index: currentEntityIndex.value,
				viewMode: viewMode.value
			}, '', url)
		}

		function readUrlParams() {
			const params = new URLSearchParams(window.location.search)
			const category = params.get('category')
			const index = params.get('index')

			if (category && categoryMapping[category]) {
				currentCategory.value = category
			}

			if (index) {
				currentEntityIndex.value = index
				viewMode.value = 'detail'
			}
		}

		onMounted(() => {
			readUrlParams()

			window.addEventListener('popstate', (event) => {
				if (event.state) {
					if (event.state.category) {
						currentCategory.value = event.state.category
					}
					if (event.state.index) {
						currentEntityIndex.value = event.state.index
						viewMode.value = 'detail'
					} else {
						currentEntityIndex.value = ''
						viewMode.value = 'list'
					}
					searchQuery.value = ''
				}
			})
		})

		return {
			currentCategory,
			searchQuery,
			viewMode,
			currentEntityIndex,
			categoryMapping,
			handleTabChange,
			handleSearch,
			handleViewEntity,
			handleBackToList,
			handleCrossRefNavigate,
			t
		}
	}
}
