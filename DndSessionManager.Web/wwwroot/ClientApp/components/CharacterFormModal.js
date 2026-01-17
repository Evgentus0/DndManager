import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

export default {
	name: 'CharacterFormModal',
	template: `
		<div class="modal fade" ref="modalRef" tabindex="-1" aria-hidden="true">
			<div class="modal-dialog modal-lg modal-dialog-scrollable">
				<div class="modal-content">
					<div class="modal-header">
						<h5 class="modal-title">{{ $t('lobby.character.form.title') }}</h5>
						<button type="button" class="btn-close" @click="close" aria-label="Close"></button>
					</div>
					<div class="modal-body">
						<form @submit.prevent="submit">
							<!-- Basic Info -->
							<div class="row g-3 mb-4">
								<div class="col-md-6">
									<label class="form-label">{{ $t('lobby.character.form.name') }} *</label>
									<input type="text" class="form-control" v-model="form.name" required maxlength="100">
								</div>
								<div class="col-md-3">
									<label class="form-label">{{ $t('lobby.character.form.level') }}</label>
									<input type="number" class="form-control" v-model.number="form.level" min="1" max="20">
								</div>
								<div class="col-md-3">
									<label class="form-label">{{ $t('lobby.character.form.proficiency') }}</label>
									<input type="number" class="form-control" v-model.number="form.proficiencyBonus" min="2" max="6" readonly>
								</div>
							</div>

							<!-- Race Selection -->
							<div class="row g-3 mb-4">
								<div class="col-md-6">
									<label class="form-label">{{ $t('lobby.character.form.race') }}</label>
									<select class="form-select" v-model="selectedRace" @change="onRaceChange">
										<option value="">-- {{ $t('lobby.character.form.race') }} --</option>
										<option v-for="race in races" :key="race.index" :value="race.index">
											{{ race.name }}
										</option>
										<option value="__custom__">{{ $t('lobby.character.form.customOption') }}</option>
									</select>
									<input v-if="selectedRace === '__custom__'" type="text" class="form-control mt-2"
										v-model="form.raceName" :placeholder="$t('lobby.character.form.race')" maxlength="50">
								</div>

								<!-- Class Selection -->
								<div class="col-md-6">
									<label class="form-label">{{ $t('lobby.character.form.class') }}</label>
									<select class="form-select" v-model="selectedClass" @change="onClassChange">
										<option value="">-- {{ $t('lobby.character.form.class') }} --</option>
										<option v-for="cls in classes" :key="cls.index" :value="cls.index">
											{{ cls.name }}
										</option>
										<option value="__custom__">{{ $t('lobby.character.form.customOption') }}</option>
									</select>
									<input v-if="selectedClass === '__custom__'" type="text" class="form-control mt-2"
										v-model="form.className" :placeholder="$t('lobby.character.form.class')" maxlength="50">
								</div>
							</div>

							<!-- Hit Points & Armor Class -->
							<div class="row g-3 mb-4">
								<div class="col-md-4">
									<label class="form-label">{{ $t('lobby.character.form.maxHp') }}</label>
									<input type="number" class="form-control" v-model.number="form.maxHitPoints" min="1" max="999">
								</div>
								<div class="col-md-4">
									<label class="form-label">{{ $t('lobby.character.form.currentHp') }}</label>
									<input type="number" class="form-control" v-model.number="form.currentHitPoints" min="0" :max="form.maxHitPoints">
								</div>
								<div class="col-md-4">
									<label class="form-label">{{ $t('lobby.character.form.ac') }}</label>
									<input type="number" class="form-control" v-model.number="form.armorClass" min="1" max="30">
								</div>
							</div>

							<!-- Ability Scores -->
							<h6 class="mb-3">{{ $t('lobby.character.form.abilities') }}</h6>
							<div class="row g-3 mb-4">
								<div class="col-4 col-md-2">
									<label class="form-label small">{{ $t('lobby.character.form.str') }}</label>
									<div class="input-group input-group-sm">
										<button type="button" class="btn btn-outline-secondary" @click="decrement('strength')">-</button>
										<input type="number" class="form-control text-center" v-model.number="form.strength" min="1" max="30">
										<button type="button" class="btn btn-outline-secondary" @click="increment('strength')">+</button>
									</div>
									<div class="text-center small text-muted">{{ getModifier(form.strength) }}</div>
								</div>
								<div class="col-4 col-md-2">
									<label class="form-label small">{{ $t('lobby.character.form.dex') }}</label>
									<div class="input-group input-group-sm">
										<button type="button" class="btn btn-outline-secondary" @click="decrement('dexterity')">-</button>
										<input type="number" class="form-control text-center" v-model.number="form.dexterity" min="1" max="30">
										<button type="button" class="btn btn-outline-secondary" @click="increment('dexterity')">+</button>
									</div>
									<div class="text-center small text-muted">{{ getModifier(form.dexterity) }}</div>
								</div>
								<div class="col-4 col-md-2">
									<label class="form-label small">{{ $t('lobby.character.form.con') }}</label>
									<div class="input-group input-group-sm">
										<button type="button" class="btn btn-outline-secondary" @click="decrement('constitution')">-</button>
										<input type="number" class="form-control text-center" v-model.number="form.constitution" min="1" max="30">
										<button type="button" class="btn btn-outline-secondary" @click="increment('constitution')">+</button>
									</div>
									<div class="text-center small text-muted">{{ getModifier(form.constitution) }}</div>
								</div>
								<div class="col-4 col-md-2">
									<label class="form-label small">{{ $t('lobby.character.form.int') }}</label>
									<div class="input-group input-group-sm">
										<button type="button" class="btn btn-outline-secondary" @click="decrement('intelligence')">-</button>
										<input type="number" class="form-control text-center" v-model.number="form.intelligence" min="1" max="30">
										<button type="button" class="btn btn-outline-secondary" @click="increment('intelligence')">+</button>
									</div>
									<div class="text-center small text-muted">{{ getModifier(form.intelligence) }}</div>
								</div>
								<div class="col-4 col-md-2">
									<label class="form-label small">{{ $t('lobby.character.form.wis') }}</label>
									<div class="input-group input-group-sm">
										<button type="button" class="btn btn-outline-secondary" @click="decrement('wisdom')">-</button>
										<input type="number" class="form-control text-center" v-model.number="form.wisdom" min="1" max="30">
										<button type="button" class="btn btn-outline-secondary" @click="increment('wisdom')">+</button>
									</div>
									<div class="text-center small text-muted">{{ getModifier(form.wisdom) }}</div>
								</div>
								<div class="col-4 col-md-2">
									<label class="form-label small">{{ $t('lobby.character.form.cha') }}</label>
									<div class="input-group input-group-sm">
										<button type="button" class="btn btn-outline-secondary" @click="decrement('charisma')">-</button>
										<input type="number" class="form-control text-center" v-model.number="form.charisma" min="1" max="30">
										<button type="button" class="btn btn-outline-secondary" @click="increment('charisma')">+</button>
									</div>
									<div class="text-center small text-muted">{{ getModifier(form.charisma) }}</div>
								</div>
							</div>

							<!-- Background & Notes -->
							<div class="row g-3">
								<div class="col-md-6">
									<label class="form-label">{{ $t('lobby.character.form.background') }}</label>
									<input type="text" class="form-control" v-model="form.background" maxlength="100">
								</div>
								<div class="col-md-6">
									<label class="form-label">{{ $t('lobby.character.form.notes') }}</label>
									<textarea class="form-control" v-model="form.notes" rows="2" maxlength="500"></textarea>
								</div>
							</div>
						</form>
					</div>
					<div class="modal-footer">
						<button type="button" class="btn btn-secondary" @click="close">
							{{ $t('lobby.character.form.cancel') }}
						</button>
						<button type="button" class="btn btn-primary" @click="submit" :disabled="!isValid || isSaving">
							<span v-if="isSaving" class="spinner-border spinner-border-sm me-1"></span>
							{{ $t('lobby.character.form.save') }}
						</button>
					</div>
				</div>
			</div>
		</div>
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
		races: {
			type: Array,
			default: () => []
		},
		classes: {
			type: Array,
			default: () => []
		}
	},
	emits: ['character-saved'],
	setup(props, { emit }) {
		const { t } = useI18n()

		const modalRef = ref(null)
		const modalInstance = ref(null)
		const isEditing = ref(false)
		const editingCharacterId = ref(null)
		const isSaving = ref(false)

		const selectedRace = ref('')
		const selectedClass = ref('')

		const defaultForm = () => ({
			name: '',
			raceIndex: null,
			classIndex: null,
			raceName: '',
			className: '',
			level: 1,
			maxHitPoints: 10,
			currentHitPoints: 10,
			armorClass: 10,
			proficiencyBonus: 2,
			strength: 10,
			dexterity: 10,
			constitution: 10,
			intelligence: 10,
			wisdom: 10,
			charisma: 10,
			background: '',
			notes: ''
		})

		const form = ref(defaultForm())

		const isValid = computed(() => {
			return form.value.name.trim().length > 0
		})

		// Calculate proficiency bonus based on level
		watch(() => form.value.level, (newLevel) => {
			if (newLevel >= 1 && newLevel <= 4) form.value.proficiencyBonus = 2
			else if (newLevel >= 5 && newLevel <= 8) form.value.proficiencyBonus = 3
			else if (newLevel >= 9 && newLevel <= 12) form.value.proficiencyBonus = 4
			else if (newLevel >= 13 && newLevel <= 16) form.value.proficiencyBonus = 5
			else if (newLevel >= 17) form.value.proficiencyBonus = 6
		})

		function getModifier(score) {
			const mod = Math.floor((score - 10) / 2)
			return mod >= 0 ? `+${mod}` : `${mod}`
		}

		function increment(stat) {
			if (form.value[stat] < 30) {
				form.value[stat]++
			}
		}

		function decrement(stat) {
			if (form.value[stat] > 1) {
				form.value[stat]--
			}
		}

		function onRaceChange() {
			if (selectedRace.value === '__custom__') {
				form.value.raceIndex = null
				form.value.raceName = ''
			} else if (selectedRace.value) {
				const race = props.races.find(r => r.index === selectedRace.value)
				form.value.raceIndex = selectedRace.value
				form.value.raceName = race ? race.name : selectedRace.value
			} else {
				form.value.raceIndex = null
				form.value.raceName = ''
			}
		}

		function onClassChange() {
			if (selectedClass.value === '__custom__') {
				form.value.classIndex = null
				form.value.className = ''
			} else if (selectedClass.value) {
				const cls = props.classes.find(c => c.index === selectedClass.value)
				form.value.classIndex = selectedClass.value
				form.value.className = cls ? cls.name : selectedClass.value
			} else {
				form.value.classIndex = null
				form.value.className = ''
			}
		}

		function openForCreate() {
			isEditing.value = false
			editingCharacterId.value = null
			form.value = defaultForm()
			selectedRace.value = ''
			selectedClass.value = ''
			showModal()
		}

		function openForEdit(character) {
			isEditing.value = true
			editingCharacterId.value = character.id

			form.value = {
				name: character.name || '',
				raceIndex: character.raceIndex,
				classIndex: character.classIndex,
				raceName: character.raceName || '',
				className: character.className || '',
				level: character.level || 1,
				maxHitPoints: character.maxHitPoints || 10,
				currentHitPoints: character.currentHitPoints || 10,
				armorClass: character.armorClass || 10,
				proficiencyBonus: character.proficiencyBonus || 2,
				strength: character.strength || 10,
				dexterity: character.dexterity || 10,
				constitution: character.constitution || 10,
				intelligence: character.intelligence || 10,
				wisdom: character.wisdom || 10,
				charisma: character.charisma || 10,
				background: character.background || '',
				notes: character.notes || ''
			}

			// Set selected values for dropdowns
			if (character.raceIndex) {
				selectedRace.value = character.raceIndex
			} else if (character.raceName) {
				selectedRace.value = '__custom__'
			} else {
				selectedRace.value = ''
			}

			if (character.classIndex) {
				selectedClass.value = character.classIndex
			} else if (character.className) {
				selectedClass.value = '__custom__'
			} else {
				selectedClass.value = ''
			}

			showModal()
		}

		function showModal() {
			if (modalRef.value && window.bootstrap) {
				modalInstance.value = new window.bootstrap.Modal(modalRef.value)
				modalInstance.value.show()
			}
		}

		function close() {
			if (modalInstance.value) {
				modalInstance.value.hide()
			}
		}

		async function submit() {
			if (!isValid.value || isSaving.value) return

			isSaving.value = true

			try {
				const characterData = {
					id: editingCharacterId.value,
					name: form.value.name.trim(),
					raceIndex: form.value.raceIndex,
					classIndex: form.value.classIndex,
					raceName: form.value.raceName,
					className: form.value.className,
					level: form.value.level,
					maxHitPoints: form.value.maxHitPoints,
					currentHitPoints: form.value.currentHitPoints,
					armorClass: form.value.armorClass,
					proficiencyBonus: form.value.proficiencyBonus,
					strength: form.value.strength,
					dexterity: form.value.dexterity,
					constitution: form.value.constitution,
					intelligence: form.value.intelligence,
					wisdom: form.value.wisdom,
					charisma: form.value.charisma,
					background: form.value.background,
					notes: form.value.notes
				}

				if (isEditing.value) {
					await props.connection.invoke('UpdateCharacter', props.sessionId, props.userId, characterData)
				} else {
					await props.connection.invoke('CreateCharacter', props.sessionId, props.userId, characterData)
				}

				emit('character-saved')
				close()
			} catch (err) {
				console.error('Error saving character:', err)
				alert('Error saving character: ' + err.message)
			} finally {
				isSaving.value = false
			}
		}

		return {
			modalRef,
			form,
			selectedRace,
			selectedClass,
			isEditing,
			isSaving,
			isValid,
			getModifier,
			increment,
			decrement,
			onRaceChange,
			onClassChange,
			openForCreate,
			openForEdit,
			close,
			submit
		}
	}
}
