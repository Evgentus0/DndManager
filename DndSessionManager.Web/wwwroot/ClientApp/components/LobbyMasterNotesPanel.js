import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { marked } from 'marked'

export default {
	name: 'LobbyMasterNotesPanel',
	props: {
		connection: { type: Object, required: true },
		sessionId: { type: String, required: true },
		userId: { type: String, required: true }
	},
	setup(props) {
		const { t } = useI18n()

		// Reactive state
		const notesMarkdown = ref('')
		const mode = ref('edit') // 'edit' or 'view'
		const isSaving = ref(false)
		const headerTree = ref([])
		const textareaRef = ref(null)

		// Computed
		const renderedHtml = computed(() => {
			if (mode.value === 'view') {
				try {
					return marked.parse(notesMarkdown.value || '')
				} catch (err) {
					console.error('Markdown parsing error:', err)
					return '<p>Error rendering markdown</p>'
				}
			}
			return ''
		})

		// Parse headers from markdown text
		function parseHeaders() {
			const headerRegex = /^(#{1,6})\s+(.+)$/gm
			const flatHeaders = []
			let match

			while ((match = headerRegex.exec(notesMarkdown.value)) !== null) {
				flatHeaders.push({
					level: match[1].length,
					text: match[2],
					line: countLines(notesMarkdown.value, match.index),
					index: match.index
				})
			}

			headerTree.value = buildHeaderTree(flatHeaders)
		}

		// Count lines up to a given index
		function countLines(text, index) {
			return text.substring(0, index).split('\n').length
		}

		// Build hierarchical tree from flat headers list
		function buildHeaderTree(flatHeaders) {
			if (flatHeaders.length === 0) return []

			const tree = []
			const stack = []

			for (const header of flatHeaders) {
				const node = {
					...header,
					expanded: true,
					children: []
				}

				// Find the appropriate parent based on level
				while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
					stack.pop()
				}

				if (stack.length === 0) {
					// Root level header
					tree.push(node)
				} else {
					// Child header
					stack[stack.length - 1].children.push(node)
				}

				stack.push(node)
			}

			return tree
		}

		// Toggle expand/collapse for a header node
		function toggleHeaderExpand(header) {
			header.expanded = !header.expanded
		}

		// Scroll to a header in the textarea or rendered view
		function scrollToHeader(header) {
			if (mode.value === 'edit') {
				// Scroll textarea to line
				const textarea = textareaRef.value
				if (textarea) {
					const lines = notesMarkdown.value.split('\n')
					const charIndex = lines.slice(0, header.line - 1).join('\n').length + (header.line > 1 ? 1 : 0)

					textarea.focus()
					textarea.setSelectionRange(charIndex, charIndex + header.text.length + header.level + 1)

					// Scroll to the line
					const lineHeight = 20 // Approximate line height in pixels
					textarea.scrollTop = (header.line - 1) * lineHeight
				}
			} else {
				// In view mode, scroll to the rendered header
				nextTick(() => {
					const viewContainer = document.querySelector('.notes-view')
					if (viewContainer) {
						// Find the header element by text content
						const headers = viewContainer.querySelectorAll('h1, h2, h3, h4, h5, h6')
						for (const el of headers) {
							if (el.textContent === header.text) {
								// Scroll within the container instead of the whole page
								const containerRect = viewContainer.getBoundingClientRect()
								const elementRect = el.getBoundingClientRect()
								const relativeTop = elementRect.top - containerRect.top + viewContainer.scrollTop

								viewContainer.scrollTo({
									top: relativeTop,
									behavior: 'smooth'
								})
								break
							}
						}
					}
				})
			}
		}

		// Insert markdown syntax at cursor position
		function insertMarkdown(syntax) {
			const textarea = textareaRef.value
			if (!textarea) return

			const start = textarea.selectionStart
			const end = textarea.selectionEnd
			const selectedText = notesMarkdown.value.substring(start, end)
			const lineStart = notesMarkdown.value.lastIndexOf('\n', start - 1) + 1
			const lineEnd = notesMarkdown.value.indexOf('\n', end)
			const currentLine = notesMarkdown.value.substring(lineStart, lineEnd === -1 ? notesMarkdown.value.length : lineEnd)

			let newText = notesMarkdown.value
			let newCursorPos = start

			switch (syntax) {
				case 'bold':
					newText = notesMarkdown.value.substring(0, start) + '**' + selectedText + '**' + notesMarkdown.value.substring(end)
					newCursorPos = end + 4
					break
				case 'italic':
					newText = notesMarkdown.value.substring(0, start) + '*' + selectedText + '*' + notesMarkdown.value.substring(end)
					newCursorPos = end + 2
					break
				case 'h1':
					if (start === lineStart) {
						newText = notesMarkdown.value.substring(0, start) + '# ' + notesMarkdown.value.substring(start)
						newCursorPos = start + 2
					} else {
						newText = notesMarkdown.value.substring(0, start) + '\n# ' + selectedText + notesMarkdown.value.substring(end)
						newCursorPos = end + 4
					}
					break
				case 'h2':
					if (start === lineStart) {
						newText = notesMarkdown.value.substring(0, start) + '## ' + notesMarkdown.value.substring(start)
						newCursorPos = start + 3
					} else {
						newText = notesMarkdown.value.substring(0, start) + '\n## ' + selectedText + notesMarkdown.value.substring(end)
						newCursorPos = end + 5
					}
					break
				case 'h3':
					if (start === lineStart) {
						newText = notesMarkdown.value.substring(0, start) + '### ' + notesMarkdown.value.substring(start)
						newCursorPos = start + 4
					} else {
						newText = notesMarkdown.value.substring(0, start) + '\n### ' + selectedText + notesMarkdown.value.substring(end)
						newCursorPos = end + 6
					}
					break
				case 'list':
					if (start === lineStart) {
						newText = notesMarkdown.value.substring(0, start) + '- ' + notesMarkdown.value.substring(start)
						newCursorPos = start + 2
					} else {
						newText = notesMarkdown.value.substring(0, start) + '\n- ' + selectedText + notesMarkdown.value.substring(end)
						newCursorPos = end + 4
					}
					break
				case 'link':
					const linkText = selectedText || 'link text'
					newText = notesMarkdown.value.substring(0, start) + '[' + linkText + '](url)' + notesMarkdown.value.substring(end)
					newCursorPos = end + linkText.length + 3
					break
			}

			notesMarkdown.value = newText
			nextTick(() => {
				textarea.focus()
				textarea.setSelectionRange(newCursorPos, newCursorPos)
			})
		}

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
				await props.connection.invoke('LoadMasterNotes', props.sessionId, props.userId)
			} catch (err) {
				console.error('Error loading notes:', err)
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
				await props.connection.invoke('SaveMasterNotes', props.sessionId, props.userId, notesMarkdown.value)
			} catch (err) {
				console.error('Error saving notes:', err)
				alert(t('lobby.masterNotes.errors.saveFailed'))
			} finally {
				isSaving.value = false
			}
		}

		// SignalR event handlers
		function setupSignalRHandlers() {
			props.connection.on('NotesLoaded', (notes) => {
				notesMarkdown.value = notes
				parseHeaders()
			})

			props.connection.on('NotesSaved', () => {
				// Success - could show a temporary success message
			})

			props.connection.on('NotesError', (message) => {
				alert(message)
			})
		}

		// Watch for markdown changes to update header tree
		watch(notesMarkdown, () => {
			parseHeaders()
		})

		// Lifecycle
		onMounted(() => {
			setupSignalRHandlers()
			loadNotes()
		})

		return {
			notesMarkdown,
			mode,
			isSaving,
			headerTree,
			renderedHtml,
			textareaRef,
			saveNotes,
			toggleHeaderExpand,
			scrollToHeader,
			insertMarkdown,
			t
		}
	},
	template: `
		<div class="card shadow-sm">
			<div class="card-header bg-primary text-white">
				<h5 class="mb-0">{{ t('lobby.masterNotes.title') }}</h5>
			</div>
			<div class="card-body p-0">
				<div class="notes-panel">
					<!-- Navigation Sidebar -->
					<div class="notes-navigation">
						<h6 class="px-3 pt-3 pb-2 mb-0 text-muted">{{ t('lobby.masterNotes.navigation') }}</h6>
						<div v-if="headerTree.length === 0" class="px-3 py-2 text-muted small">
							{{ t('lobby.masterNotes.noHeaders') }}
						</div>
						<div v-else class="header-tree">
							<tree-node
								v-for="header in headerTree"
								:key="header.line"
								:header="header"
								:on-toggle="toggleHeaderExpand"
								:on-click="scrollToHeader"
							></tree-node>
						</div>
					</div>

					<!-- Editor/Viewer Area -->
					<div class="notes-editor">
						<textarea
							v-if="mode === 'edit'"
							ref="textareaRef"
							v-model="notesMarkdown"
							class="notes-textarea"
							:placeholder="t('lobby.masterNotes.placeholder')"
						></textarea>
						<div
							v-else
							class="notes-view"
							v-html="renderedHtml"
						></div>
					</div>

					<!-- Toolbar -->
					<div class="notes-toolbar">
						<div class="btn-group-vertical w-100 mb-3">
							<button
								@click="mode = 'edit'"
								class="btn btn-sm"
								:class="mode === 'edit' ? 'btn-primary' : 'btn-outline-primary'"
							>
								{{ t('lobby.masterNotes.editMode') }}
							</button>
							<button
								@click="mode = 'view'"
								class="btn btn-sm"
								:class="mode === 'view' ? 'btn-primary' : 'btn-outline-primary'"
							>
								{{ t('lobby.masterNotes.viewMode') }}
							</button>
						</div>

						<button
							@click="saveNotes"
							:disabled="isSaving"
							class="btn btn-success w-100 mb-3"
						>
							{{ isSaving ? t('lobby.masterNotes.saving') : t('lobby.masterNotes.saveButton') }}
						</button>

						<hr>

						<div v-if="mode === 'edit'" class="markdown-toolbar">
							<button @click="insertMarkdown('bold')" class="btn btn-sm btn-outline-secondary w-100 mb-2" title="Bold">
								<strong>B</strong>
							</button>
							<button @click="insertMarkdown('italic')" class="btn btn-sm btn-outline-secondary w-100 mb-2" title="Italic">
								<em>I</em>
							</button>
							<button @click="insertMarkdown('h1')" class="btn btn-sm btn-outline-secondary w-100 mb-2" title="Heading 1">
								H1
							</button>
							<button @click="insertMarkdown('h2')" class="btn btn-sm btn-outline-secondary w-100 mb-2" title="Heading 2">
								H2
							</button>
							<button @click="insertMarkdown('h3')" class="btn btn-sm btn-outline-secondary w-100 mb-2" title="Heading 3">
								H3
							</button>
							<button @click="insertMarkdown('list')" class="btn btn-sm btn-outline-secondary w-100 mb-2" title="List">
								• {{ t('lobby.masterNotes.toolbar.list') }}
							</button>
							<button @click="insertMarkdown('link')" class="btn btn-sm btn-outline-secondary w-100 mb-2" title="Link">
								{{ t('lobby.masterNotes.toolbar.link') }}
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	`,
	components: {
		'tree-node': {
			name: 'TreeNode',
			props: {
				header: { type: Object, required: true },
				onToggle: { type: Function, required: true },
				onClick: { type: Function, required: true }
			},
			template: `
				<div class="tree-node-container">
					<div
						class="tree-node"
						:style="{ paddingLeft: (header.level * 15) + 'px' }"
					>
						<i
							v-if="header.children.length > 0"
							class="tree-icon bi"
							:class="header.expanded ? 'bi-chevron-down' : 'bi-chevron-right'"
							@click.stop="onToggle(header)"
						></i>
						<span class="tree-text" @click="onClick(header)">{{ header.text }}</span>
					</div>
					<div v-if="header.expanded && header.children.length > 0">
						<tree-node
							v-for="child in header.children"
							:key="child.line"
							:header="child"
							:onToggle="onToggle"
							:onClick="onClick"
						></tree-node>
					</div>
				</div>
			`
		}
	}
}
