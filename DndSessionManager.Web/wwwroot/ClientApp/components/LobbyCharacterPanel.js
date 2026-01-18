import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import CharacterFormModal from './CharacterFormModal.js'

export default {
	name: 'LobbyCharacterPanel',
	components: {
		CharacterFormModal
	},
	template: `
		<div class="card shadow-sm h-100">
			<div class="card-header bg-dark text-white d-flex justify-content-between align-items-center">
				<h5 class="mb-0">{{ $t('lobby.character.title') }}</h5>
				<button v-if="!myCharacter" class="btn btn-sm btn-success" @click="openCreateModal">
					<i class="bi bi-plus-lg me-1"></i>{{ $t('lobby.character.createButton') }}
				</button>
			</div>
			<div class="card-body">
				<div v-if="characters.length === 0" class="text-muted text-center py-4">
					<i class="bi bi-person-badge fs-1 mb-3 d-block"></i>
					<p>{{ $t('lobby.character.noCharacter') }}</p>
				</div>

				<div v-else class="row g-3">
					<div v-for="char in characters" :key="char.id" class="col-12">
						<div class="card" :class="{ 'border-primary': isMyCharacter(char) }">
							<div class="card-body">
								<div class="d-flex justify-content-between align-items-start">
									<div>
										<h5 class="card-title mb-1">{{ char.name }}</h5>
										<p class="card-text text-muted mb-2">
											<a v-if="char.raceIndex" :href="raceLink(char)" class="text-decoration-none">
												{{ char.raceName }}
											</a>
											<span v-else>{{ char.raceName }}</span>
											&bull;
											<a v-if="char.classIndex" :href="classLink(char)" class="text-decoration-none">
												{{ char.className }}
											</a>
											<span v-else>{{ char.className }}</span>
											&bull;
											{{ $t('lobby.character.form.level') }} {{ char.level }}
										</p>
									</div>
									<div v-if="canEdit(char)" class="btn-group">
										<button class="btn btn-sm btn-outline-primary" @click="openEditModal(char)">
											<i class="bi bi-pencil"></i>
										</button>
										<button class="btn btn-sm btn-outline-danger" @click="deleteCharacter(char)">
											<i class="bi bi-trash"></i>
										</button>
									</div>
								</div>

								<div v-if="canSeeFullStats(char)" class="mt-3">
									<div class="row g-2 mb-2">
										<div class="col-4 col-md-2">
											<div class="text-center border rounded p-2">
												<div class="small">
													<a :href="abilityLink('str')" class="text-muted text-decoration-none">{{ $t('lobby.character.form.str') }}</a>
												</div>
												<div class="fw-bold">{{ char.strength }}</div>
												<div class="small text-muted">({{ getModifier(char.strength) }})</div>
											</div>
										</div>
										<div class="col-4 col-md-2">
											<div class="text-center border rounded p-2">
												<div class="small">
													<a :href="abilityLink('dex')" class="text-muted text-decoration-none">{{ $t('lobby.character.form.dex') }}</a>
												</div>
												<div class="fw-bold">{{ char.dexterity }}</div>
												<div class="small text-muted">({{ getModifier(char.dexterity) }})</div>
											</div>
										</div>
										<div class="col-4 col-md-2">
											<div class="text-center border rounded p-2">
												<div class="small">
													<a :href="abilityLink('con')" class="text-muted text-decoration-none">{{ $t('lobby.character.form.con') }}</a>
												</div>
												<div class="fw-bold">{{ char.constitution }}</div>
												<div class="small text-muted">({{ getModifier(char.constitution) }})</div>
											</div>
										</div>
										<div class="col-4 col-md-2">
											<div class="text-center border rounded p-2">
												<div class="small">
													<a :href="abilityLink('int')" class="text-muted text-decoration-none">{{ $t('lobby.character.form.int') }}</a>
												</div>
												<div class="fw-bold">{{ char.intelligence }}</div>
												<div class="small text-muted">({{ getModifier(char.intelligence) }})</div>
											</div>
										</div>
										<div class="col-4 col-md-2">
											<div class="text-center border rounded p-2">
												<div class="small">
													<a :href="abilityLink('wis')" class="text-muted text-decoration-none">{{ $t('lobby.character.form.wis') }}</a>
												</div>
												<div class="fw-bold">{{ char.wisdom }}</div>
												<div class="small text-muted">({{ getModifier(char.wisdom) }})</div>
											</div>
										</div>
										<div class="col-4 col-md-2">
											<div class="text-center border rounded p-2">
												<div class="small">
													<a :href="abilityLink('cha')" class="text-muted text-decoration-none">{{ $t('lobby.character.form.cha') }}</a>
												</div>
												<div class="fw-bold">{{ char.charisma }}</div>
												<div class="small text-muted">({{ getModifier(char.charisma) }})</div>
											</div>
										</div>
									</div>

									<div class="d-flex gap-3 text-muted small">
										<span><strong>HP:</strong> {{ char.currentHitPoints }}/{{ char.maxHitPoints }}</span>
										<span><strong>AC:</strong> {{ char.armorClass }}</span>
										<span><strong>{{ $t('lobby.character.form.proficiency') }}:</strong> +{{ char.proficiencyBonus }}</span>
									</div>

									<div v-if="char.skills && char.skills.length > 0" class="mt-2">
										<strong class="small">{{ $t('lobby.character.form.skills') }}:</strong>
										<div class="d-flex flex-wrap gap-1 mt-1">
											<a v-for="skillIndex in char.skills" :key="skillIndex"
												:href="skillLink(skillIndex)"
												class="badge bg-secondary text-decoration-none">
												{{ getSkillName(skillIndex) }}
											</a>
										</div>
									</div>

									<div v-if="char.background" class="mt-2 small">
										<strong>{{ $t('lobby.character.form.background') }}:</strong> {{ char.background }}
									</div>
									<div v-if="char.notes" class="mt-2 small text-muted fst-italic">
										{{ char.notes }}
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<character-form-modal
			ref="formModalRef"
			:connection="connection"
			:session-id="sessionId"
			:user-id="userId"
			:races="races"
			:classes="classes"
			@character-saved="onCharacterSaved">
		</character-form-modal>
	`,
	props: {
		connection: {
			type: Object,
			required: true
		},
		sessionId: {
			type: String,
			required: true
		},
		userId: {
			type: String,
			required: true
		},
		isMaster: {
			type: Boolean,
			default: false
		}
	},
	setup(props) {
		const { t } = useI18n()

		const characters = ref([])
		const races = ref([])
		const classes = ref([])
		const skills = ref([])
		const formModalRef = ref(null)

		const myCharacter = computed(() => {
			return characters.value.find(c => c.ownerId === props.userId)
		})

		function isMyCharacter(char) {
			return char.ownerId === props.userId
		}

		function canSeeFullStats(char) {
			return props.isMaster || char.ownerId === props.userId
		}

		function canEdit(char) {
			return props.isMaster || char.ownerId === props.userId
		}

		function getModifier(score) {
			const mod = Math.floor((score - 10) / 2)
			return mod >= 0 ? `+${mod}` : `${mod}`
		}

		function raceLink(char) {
			return `/handbook?category=races&index=${char.raceIndex}`
		}

		function classLink(char) {
			return `/handbook?category=classes&index=${char.classIndex}`
		}

		function abilityLink(abilityIndex) {
			return `/handbook?category=abilityScores&index=${abilityIndex}`
		}

		function skillLink(skillIndex) {
			return `/handbook?category=skills&index=${skillIndex}`
		}

		function getSkillName(skillIndex) {
			const skill = skills.value.find(s => s.index === skillIndex)
			return skill ? skill.name : skillIndex
		}

		function openCreateModal() {
			if (formModalRef.value) {
				formModalRef.value.openForCreate()
			}
		}

		function openEditModal(char) {
			if (formModalRef.value) {
				formModalRef.value.openForEdit(char)
			}
		}

		async function deleteCharacter(char) {
			if (confirm(t('lobby.character.deleteConfirm'))) {
				try {
					await props.connection.invoke('DeleteCharacter', props.sessionId, props.userId, char.id)
				} catch (err) {
					console.error('Error deleting character:', err)
				}
			}
		}

		function onCharacterSaved() {
			// Modal handles the save, SignalR will update the list
		}

		async function fetchHandbookData() {
			try {
				const savedLanguage = localStorage.getItem('user-language')
				const browserLanguage = navigator.language.split('-')[0]
				const defaultLanguage = savedLanguage || (browserLanguage === 'ru' ? 'ru' : 'en')
				const [racesRes, classesRes, skillsRes] = await Promise.all([
					fetch('/api/handbook/races', { headers: { 'X-Locale': defaultLanguage } }),
					fetch('/api/handbook/classes', { headers: { 'X-Locale': defaultLanguage } }),
					fetch('/api/handbook/skills', { headers: { 'X-Locale': defaultLanguage } })
				])

				if (racesRes.ok) {
					races.value = await racesRes.json()
				}
				if (classesRes.ok) {
					classes.value = await classesRes.json()
				}
				if (skillsRes.ok) {
					skills.value = await skillsRes.json()
				}
			} catch (err) {
				console.error('Error fetching handbook data:', err)
			}
		}

		function setupSignalRHandlers() {
			if (!props.connection) return

			props.connection.on('CharacterList', (characterList) => {
				characters.value = characterList
			})

			props.connection.on('CharacterCreated', (character) => {
				const existingIndex = characters.value.findIndex(c => c.id === character.id)
				if (existingIndex === -1) {
					characters.value.push(character)
				}
			})

			props.connection.on('CharacterUpdated', (character) => {
				const index = characters.value.findIndex(c => c.id === character.id)
				if (index !== -1) {
					characters.value[index] = character
				}
			})

			props.connection.on('CharacterDeleted', (characterId) => {
				characters.value = characters.value.filter(c => c.id !== characterId)
			})

			props.connection.on('CharacterError', (message) => {
				alert(message)
			})
		}

		onMounted(() => {
			setupSignalRHandlers()
			fetchHandbookData()
		})

		return {
			characters,
			races,
			classes,
			skills,
			formModalRef,
			myCharacter,
			isMyCharacter,
			canSeeFullStats,
			canEdit,
			getModifier,
			raceLink,
			classLink,
			abilityLink,
			skillLink,
			getSkillName,
			openCreateModal,
			openEditModal,
			deleteCharacter,
			onCharacterSaved
		}
	}
}
