import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCharacterData } from '../composables/useCharacterData.js'
import CharacterFormModal from './CharacterFormModal.js'
import CharacterCard from './CharacterCard.js'

export default {
	name: 'LobbyCharacterPanel',
	components: {
		CharacterFormModal,
		CharacterCard
	},
	template: `
		<div>
		<div class="card shadow-sm h-100">
			<div class="card-header bg-dark text-white d-flex justify-content-between align-items-center">
				<h5 class="mb-0">{{ $t('lobby.character.title') }}</h5>
				<button v-if="isMaster && !myCharacter" class="btn btn-sm btn-success" @click="openCreateModal">
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
						<character-card
							:character="char"
							:skills="skills"
							:equipment-list="equipmentList"
							:show-full-stats="isMaster"
							:show-owner="true"
							:show-edit-buttons="isMaster"
							:show-reset-password="canResetPassword(char)"
							:can-edit-ammo="canEdit(char)"
							:can-edit-spell-slots="canEdit(char)"
							:is-highlighted="isMyCharacter(char)"
							:is-owner-online="isCharacterOwnerOnline(char)"
							@edit="openEditModal"
							@delete="deleteCharacter"
							@reset-password="resetCharacterPassword"
							@update-ammo="updateAmmo"
							@use-spell-slot="useSpellSlot">
						</character-card>
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
			:skills="skills"
			:classes="classes"
			:equipment-list="equipmentList"
			:spells-list="spellsList"
			:features-list="featuresList"
			:traits-list="traitsList"
			@character-saved="onCharacterSaved">
		</character-form-modal>
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
		isMaster: {
			type: Boolean,
			default: false
		},
		users: {
			type: Array,
			default: () => []
		}
	},
	setup(props) {
		const { t } = useI18n()
		const formModalRef = ref(null)

		const {
			characters,
			races,
			classes,
			skills,
			equipmentList,
			spellsList,
			featuresList,
			traitsList,
			myCharacter,
			updateAmmo,
			useSpellSlot,
			init
		} = useCharacterData(props)

		function isMyCharacter(char) {
			return char.ownerId === props.userId
		}

		function canEdit(char) {
			return props.isMaster || char.ownerId === props.userId
		}

		function isCharacterOwnerOnline(char) {
			if (!char.ownerId) return false
			return props.users.some(u => u.id === char.ownerId)
		}

		function canResetPassword(char) {
			return props.isMaster && char.isClaimed && !isCharacterOwnerOnline(char)
		}

		async function resetCharacterPassword(char) {
			if (confirm(t('lobby.character.resetPasswordConfirm', { name: char.name }))) {
				try {
					await props.connection.invoke('ResetCharacterPassword', props.sessionId, props.userId, char.id)
				} catch (err) {
					console.error('Error resetting character password:', err)
				}
			}
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

		onMounted(() => {
			init()
		})

		return {
			isMaster: props.isMaster,
			characters,
			races,
			classes,
			skills,
			equipmentList,
			spellsList,
			featuresList,
			traitsList,
			formModalRef,
			myCharacter,
			isMyCharacter,
			canEdit,
			isCharacterOwnerOnline,
			canResetPassword,
			resetCharacterPassword,
			openCreateModal,
			openEditModal,
			deleteCharacter,
			onCharacterSaved,
			updateAmmo,
			useSpellSlot
		}
	}
}
