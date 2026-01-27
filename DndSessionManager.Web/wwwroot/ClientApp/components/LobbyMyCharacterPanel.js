import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCharacterData } from '../composables/useCharacterData.js'
import CharacterFormModal from './CharacterFormModal.js'
import CharacterCard from './CharacterCard.js'

export default {
	name: 'LobbyMyCharacterPanel',
	components: {
		CharacterFormModal,
		CharacterCard
	},
	template: `
		<div>
		<div class="card shadow-sm h-100">
			<div class="card-header bg-dark text-white d-flex justify-content-between align-items-center">
				<h5 class="mb-0">{{ $t('lobby.tabs.myCharacter') }}</h5>
				<button v-if="!myCharacter" class="btn btn-sm btn-success" @click="openCreateModal">
					<i class="bi bi-plus-lg me-1"></i>{{ $t('lobby.character.createButton') }}
				</button>
			</div>
			<div class="card-body">
				<!-- No character yet -->
				<div v-if="!myCharacter" class="text-muted text-center py-4">
					<i class="bi bi-person-badge fs-1 mb-3 d-block"></i>
					<p>{{ $t('lobby.character.noMyCharacter') }}</p>
				</div>

				<!-- My character with full details -->
				<div v-else>
					<character-card
						:character="myCharacter"
						:skills="skills"
						:equipment-list="equipmentList"
						:show-full-stats="true"
						:show-owner="false"
						:show-edit-buttons="true"
						:show-reset-password="false"
						:can-edit-ammo="true"
						:can-edit-h-p="true"
						:can-edit-spell-slots="true"
						:is-highlighted="true"
						:is-owner-online="false"
						@edit="openEditModal"
						@delete="deleteCharacter"
						@update-ammo="updateAmmo"
						@update-hp="updateHP"
						@use-spell-slot="useSpellSlot">
					</character-card>
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
		}
	},
	setup(props) {
		const { t } = useI18n()
		const formModalRef = ref(null)

		const {
			races,
			classes,
			skills,
			equipmentList,
			spellsList,
			myCharacter,
			updateAmmo,
			updateHP,
			useSpellSlot,
			init
		} = useCharacterData(props)

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
			myCharacter,
			races,
			classes,
			skills,
			equipmentList,
			spellsList,
			formModalRef,
			updateAmmo,
			updateHP,
			useSpellSlot,
			openCreateModal,
			openEditModal,
			deleteCharacter,
			onCharacterSaved
		}
	}
}
