import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import MarkdownEditorPanel from '/ClientApp/components/MarkdownEditorPanel.js'

export default {
	name: 'LobbyCharacterNotesPanel',
	props: {
		connection: { type: Object, required: true },
		sessionId: { type: String, required: true },
		userId: { type: String, required: true },
		characterId: { type: String, required: true }
	},
	setup(props) {
		const { t } = useI18n()

		// Reactive state
		const notesMarkdown = ref('')
		const isSaving = ref(false)

		// SignalR methods
		async function waitForConnection() {
			// Wait for SignalR connection to be established
			if (props.connection.state === 'Connected') {
				return
			}

			// Wait up to 5 seconds for connection
			const maxWait = 5000
			const interval = 100
			let waited = 0

			while (props.connection.state !== 'Connected' && waited < maxWait) {
				await new Promise(resolve => setTimeout(resolve, interval))
				waited += interval
			}

			if (props.connection.state !== 'Connected') {
				throw new Error('Connection timeout')
			}
		}

		async function loadNotes() {
			try {
				await waitForConnection()
				await props.connection.invoke('LoadCharacterNotes', props.sessionId, props.userId, props.characterId)
			} catch (err) {
				console.error('Error loading character notes:', err)
				// Don't show alert on initial load failure - connection might still be establishing
				if (err.message !== 'Connection timeout') {
					console.warn('Will retry when connection is established')
				}
			}
		}

		async function saveNotes() {
			isSaving.value = true
			try {
				await waitForConnection()
				await props.connection.invoke('SaveCharacterNotes', props.sessionId, props.userId, props.characterId, notesMarkdown.value)
			} catch (err) {
				console.error('Error saving character notes:', err)
				alert(t('lobby.characterNotes.errors.saveFailed'))
			} finally {
				isSaving.value = false
			}
		}

		// SignalR event handlers
		function setupSignalRHandlers() {
			props.connection.on('CharacterNotesLoaded', (notes) => {
				notesMarkdown.value = notes
			})

			props.connection.on('NotesSaved', () => {
				// Success - could show a temporary success message
			})

			props.connection.on('NotesError', (message) => {
				alert(message)
			})
		}

		// Lifecycle
		onMounted(() => {
			setupSignalRHandlers()
			loadNotes()
		})

		return {
			notesMarkdown,
			isSaving,
			saveNotes,
			t
		}
	},
	template: `
		<markdown-editor-panel
			v-model="notesMarkdown"
			:title="t('lobby.characterNotes.title')"
			:placeholder="t('lobby.characterNotes.placeholder')"
			:save-button-text="t('lobby.characterNotes.saveButton')"
			:saving-text="t('lobby.characterNotes.saving')"
			:is-saving="isSaving"
			header-bg-class="bg-dark"
			@save="saveNotes"
		></markdown-editor-panel>
	`,
	components: {
		'markdown-editor-panel': MarkdownEditorPanel
	}
}
