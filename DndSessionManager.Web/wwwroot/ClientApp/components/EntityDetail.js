import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'

export default {
	name: 'EntityDetail',
	template: `
		<div>
			<div class="mb-3">
				<button class="btn btn-secondary" @click="goBack">
					<i class="bi bi-arrow-left"></i> {{ $t('handbook.backToList') }}
				</button>
			</div>

			<div v-if="loading" class="text-center py-5">
				<div class="spinner-border text-primary" role="status">
					<span class="visually-hidden">{{ $t('handbook.loading') }}</span>
				</div>
				<p class="mt-2 text-muted">{{ $t('handbook.loading') }}</p>
			</div>

			<div v-else-if="error" class="alert alert-danger">
				{{ $t('handbook.error') }}: {{ error }}
			</div>

			<div v-else-if="entity" class="card">
				<div class="card-header">
					<h2>{{ entity.name }}</h2>
					<p class="text-muted mb-0"><small>{{ entity.index }}</small></p>
				</div>
				<div class="card-body">
					<div v-html="formattedContent"></div>
				</div>
			</div>
		</div>
	`,
	props: {
		category: {
			type: String,
			required: true
		},
		entityIndex: {
			type: String,
			required: true
		}
	},
	emits: ['back', 'navigate'],
	setup(props, { emit }) {
		const { t, locale } = useI18n()
		const entity = ref(null)
		const loading = ref(false)
		const error = ref(null)

		async function fetchEntity() {
			loading.value = true
			error.value = null

			try {
				const response = await fetch(`/api/handbook/${props.category}/${props.entityIndex}`, {
					headers: {
						'X-Locale': locale.value || 'en'
					}
				})

				if (!response.ok) {
					throw new Error(`HTTP ${response.status}`)
				}

				entity.value = await response.json()
			} catch (err) {
				error.value = err.message
				entity.value = null
			} finally {
				loading.value = false
			}
		}

		const formattedContent = computed(() => {
			if (!entity.value) return ''

			let html = '<div class="entity-details">'

			// Render different properties based on entity type
			const exclude = ['index', 'name', 'url']

			for (const [key, value] of Object.entries(entity.value)) {
				if (exclude.includes(key)) continue

				html += `<div class="detail-section mb-3">`
				html += `<h5 class="text-capitalize">${formatKey(key)}</h5>`
				html += formatValue(value)
				html += `</div>`
			}

			html += '</div>'
			return html
		})

		function formatKey(key) {
			return key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()
		}

		function isReference(obj) {
			return obj && typeof obj === 'object' && !Array.isArray(obj) && typeof obj.url === 'string'
		}

		function formatValue(value) {
			if (value === null || value === undefined) {
				return '<span class="text-muted">—</span>'
			}

			if (isReference(value)) {
				return formatReference(value)
			}

			if (Array.isArray(value)) {
				return formatArray(value)
			}

			if (typeof value === 'object') {
				return formatObject(value)
			}

			if (typeof value === 'boolean') {
				return `<span class="badge bg-${value ? 'success' : 'secondary'}">${value ? 'Yes' : 'No'}</span>`
			}

			return escapeHtml(String(value))
		}

		function formatArray(arr) {
			if (arr.length === 0) {
				return '<span class="text-muted">None</span>'
			}

			if (arr.every(item => typeof item === 'string')) {
				return arr.map(item => `<p>${escapeHtml(item)}</p>`).join('')
			}

			if (arr.every(isReference)) {
				return '<ul class="list-unstyled">' +
					arr.map(item => `<li>${formatReference(item)}</li>`).join('') +
					'</ul>'
			}

			return '<ul class="list-group list-group-flush">' +
				arr.map(item => `<li class="list-group-item">${formatValue(item)}</li>`).join('') +
				'</ul>'
		}

		function formatObject(obj) {
			const entries = Object.entries(obj).filter(([k]) => k !== 'url')

			if (entries.length === 0) {
				return '<span class="text-muted">—</span>'
			}

			return '<dl class="row mb-0">' +
				entries.map(([key, val]) =>
					`<dt class="col-sm-4 text-capitalize">${formatKey(key)}</dt>` +
					`<dd class="col-sm-8">${formatValue(val)}</dd>`
				).join('') +
				'</dl>'
		}

		function formatReference(ref) {
			if (!ref || !ref.url) return escapeHtml(ref.name || '')

			// Parse the URL to extract category and index
			const match = ref.url.match(/\/api\/2014\/([^\/]+)\/([^\/]+)/)
			if (match) {
				const [_, categoryPath, index] = match
				const category = normalizeCategoryPath(categoryPath)
				return `<a href="#" class="text-decoration-none cross-ref" data-category="${category}" data-index="${index}">${escapeHtml(ref.name)}</a>`
			}

			return escapeHtml(ref.name || '')
		}

		function normalizeCategoryPath(categoryPath) {
			// Map API paths to our category names
			const mapping = {
				'spells': 'spells',
				'monsters': 'monsters',
				'classes': 'classes',
				'equipment': 'equipment',
				'magic-items': 'magic-items',
				'features': 'features',
				'races': 'races',
				'conditions': 'conditions',
				'skills': 'skills',
				'ability-scores': 'ability-scores',
				'damage-types': 'damage-types',
				'magic-schools': 'magic-schools',
				'subclasses': 'subclasses'
			}

			return mapping[categoryPath] || categoryPath
		}

		function escapeHtml(text) {
			const div = document.createElement('div')
			div.textContent = text
			return div.innerHTML
		}

		function goBack() {
			emit('back')
		}

		function handleCrossRefClick(event) {
			const target = event.target
			if (target.classList.contains('cross-ref')) {
				event.preventDefault()
				const category = target.dataset.category
				const index = target.dataset.index
				emit('navigate', { category, index })
			}
		}

		watch(() => [props.category, props.entityIndex], fetchEntity, { immediate: true })
		watch(locale, fetchEntity)

		// Add click listener for cross-references
		watch(() => entity.value, () => {
			// Use nextTick equivalent
			setTimeout(() => {
				const detailsEl = document.querySelector('.entity-details')
				if (detailsEl) {
					detailsEl.addEventListener('click', handleCrossRefClick)
				}
			}, 100)
		})

		return {
			entity,
			loading,
			error,
			formattedContent,
			goBack,
			t
		}
	}
}
