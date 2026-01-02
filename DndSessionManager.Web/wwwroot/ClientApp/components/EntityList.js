import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

export default {
	name: 'EntityList',
	template: `
		<div>
			<div v-if="loading" class="text-center py-5">
				<div class="spinner-border text-primary" role="status">
					<span class="visually-hidden">{{ $t('handbook.loading') }}</span>
				</div>
				<p class="mt-2 text-muted">{{ $t('handbook.loading') }}</p>
			</div>
			<div v-else-if="error" class="alert alert-danger">
				{{ $t('handbook.error') }}: {{ error }}
			</div>
			<div v-else>
				<div v-if="filteredEntities.length === 0" class="alert alert-info">
					{{ $t('handbook.search.noResults') }}
				</div>
				<div v-else class="row">
					<div
						v-for="entity in filteredEntities"
						:key="entity.index"
						class="col-12 col-md-6 col-lg-4 mb-3">
						<div class="card h-100 shadow-sm">
							<div class="card-body">
								<h5 class="card-title" style="cursor: pointer;" @click="viewEntity(entity.index)">
									{{ entity.name }}
								</h5>
								<p class="card-text text-muted small mb-2">{{ entity.index }}</p>

								<!-- Spell-specific info -->
								<div v-if="category === 'spells' && entity.school" class="mb-2">
									<span
										class="badge bg-secondary me-1"
										style="cursor: pointer;"
										@click.stop="navigateToReference('magic-schools', entity.school.index)">
										{{ entity.school.name }}
									</span>
									<span v-if="entity.level !== undefined" class="badge bg-info text-dark">
										{{ $t('handbook.level') }} {{ entity.level }}
									</span>
								</div>
								<div v-if="category === 'spells' && (entity.classes || entity.subclasses)" class="small">
									<div v-if="entity.classes && entity.classes.length > 0" class="mb-1">
										<span
											v-for="cls in entity.classes"
											:key="cls.index"
											class="badge bg-primary me-1"
											style="cursor: pointer;"
											@click.stop="navigateToReference('classes', cls.index)">
											{{ cls.name }}
										</span>
									</div>
									<div v-if="entity.subclasses && entity.subclasses.length > 0">
										<span
											v-for="subcls in entity.subclasses"
											:key="subcls.index"
											class="badge bg-success me-1"
											style="cursor: pointer;"
											@click.stop="navigateToReference('subclasses', subcls.index)">
											{{ subcls.name }}
										</span>
									</div>
								</div>

								<!-- Monster-specific info -->
								<div v-if="category === 'monsters'" class="small">
									<div v-if="entity.size || entity.type" class="mb-1">
										<span v-if="entity.size" class="text-muted">{{ entity.size }}</span>
										<span v-if="entity.size && entity.type" class="text-muted"> • </span>
										<span v-if="entity.type" class="text-muted">{{ entity.type }}</span>
									</div>
									<div v-if="entity.challenge_rating !== undefined">
										<span class="badge bg-danger">CR {{ entity.challenge_rating }}</span>
									</div>
								</div>

								<!-- Class-specific info -->
								<div v-if="category === 'classes'" class="small text-muted">
									<div v-if="entity.hit_die">Hit Die: d{{ entity.hit_die }}</div>
								</div>

								<!-- Race-specific info -->
								<div v-if="category === 'races'" class="small text-muted">
									<div v-if="entity.speed !== undefined">Speed: {{ entity.speed }} ft.</div>
									<div v-if="entity.size">Size: {{ entity.size }}</div>
								</div>

								<!-- Equipment-specific info -->
								<div v-if="category === 'equipment' && entity.equipment_category" class="mb-1">
									<span
										class="badge bg-secondary"
										style="cursor: pointer;"
										@click.stop="navigateToReference('equipment-categories', entity.equipment_category.index)">
										{{ entity.equipment_category.name }}
									</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	`,
	props: {
		category: {
			type: String,
			required: true
		},
		searchQuery: {
			type: String,
			default: ''
		}
	},
	emits: ['view-entity', 'navigate'],
	setup(props, { emit }) {
		const { t, locale } = useI18n()
		const entities = ref([])
		const loading = ref(false)
		const error = ref(null)

		async function fetchEntities() {
			loading.value = true
			error.value = null

			try {
				const response = await fetch(`/api/handbook/${props.category}`, {
					headers: {
						'X-Locale': locale.value || 'en'
					}
				})

				if (!response.ok) {
					throw new Error(`HTTP ${response.status}`)
				}

				entities.value = await response.json()
			} catch (err) {
				error.value = err.message
				entities.value = []
			} finally {
				loading.value = false
			}
		}

		const filteredEntities = computed(() => {
			if (!props.searchQuery) return entities.value

			const query = props.searchQuery.toLowerCase()
			return entities.value.filter(e =>
				e.name.toLowerCase().includes(query) ||
				e.index.toLowerCase().includes(query)
			)
		})

		function viewEntity(index) {
			emit('view-entity', index)
		}

		function navigateToReference(category, index) {
			emit('navigate', { category, index })
		}

		watch(() => props.category, fetchEntities, { immediate: true })
		watch(locale, fetchEntities)

		return {
			filteredEntities,
			loading,
			error,
			viewEntity,
			navigateToReference,
			category: computed(() => props.category),
			t
		}
	}
}
