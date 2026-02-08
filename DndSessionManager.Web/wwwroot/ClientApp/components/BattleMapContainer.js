import { ref, onMounted, onUnmounted, shallowRef } from 'vue'
import { useBattleMapStore } from '../stores/useBattleMapStore.js'
import { useI18n } from 'vue-i18n'
import BattleMapCanvas from './BattleMapCanvas.js'
import BattleMapToolbar from './BattleMapToolbar.js'
import BattleMapGridSettings from './BattleMapGridSettings.js'

export default {
	name: 'BattleMapContainer',
	components: {
		BattleMapCanvas,
		BattleMapToolbar,
		BattleMapGridSettings
	},
	template: `
		<div class="battlemap-wrapper">
			<div class="alert alert-info" v-if="!connection">
				<i class="bi bi-wifi-off"></i> {{ $t('battlemap.connecting') }}
			</div>

			<div v-else class="card shadow">
				<div class="card-header bg-dark text-white">
					<div class="d-flex justify-content-between align-items-center">
						<h5 class="mb-0">
							<i class="bi bi-map"></i> {{ $t('battlemap.title') }}
							<span class="badge bg-secondary ms-2">v{{ store.version }}</span>
						</h5>
						<div>
							<span class="badge bg-info me-2">
								<i class="bi bi-grid-3x3"></i> {{ store.grid.width }}x{{ store.grid.height }}
							</span>
							<span class="badge bg-success">
								<i class="bi bi-people"></i> {{ store.tokensList.length }} tokens
							</span>
						</div>
					</div>
				</div>
				<div class="card-body p-3" style="background-color: #2c3e50;">
					<battle-map-toolbar
						:is-master="isMaster"
						:can-remove="!!store.selectedToken"
						:has-background="!!store.background.imageUrl"
						@add-token="handleAddToken"
						@remove-token="handleRemoveToken"
						@tool-changed="handleToolChanged"
						@save-map="handleSaveMap"
						@upload-background="handleUploadBackground"
						@remove-background="handleRemoveBackground"
						@edit-grid-size="handleEditGridSize">
					</battle-map-toolbar>

					<battle-map-canvas
						:session-id="sessionId"
						:user-id="userId"
						:is-master="isMaster"
						:connection="connection"
						:current-tool="currentTool"
						class="mt-3">
					</battle-map-canvas>

					<!-- Token list sidebar -->
					<div class="mt-3" v-if="store.tokensList.length > 0">
						<div class="card bg-dark">
							<div class="card-header text-white">
								<small><i class="bi bi-list-ul"></i> Tokens</small>
							</div>
							<div class="card-body p-2">
								<div class="row g-2">
									<div v-for="token in store.tokensList" :key="token.id" class="col-md-3">
										<div
											class="card card-sm"
											:class="{'border-warning': store.selectedTokenId === token.id, 'border-secondary': store.selectedTokenId !== token.id}"
											style="cursor: pointer;"
											@click="store.setSelectedToken(token.id)"
											@contextmenu.prevent="isMaster && showTokenDialog('edit', token)">
											<div class="card-body p-2">
												<div class="d-flex align-items-center">
													<div class="me-2"
														:style="{width: '24px', height: '24px', borderRadius: '50%', backgroundColor: token.color, border: '2px solid #ecf0f1'}">
													</div>
													<div class="flex-grow-1">
														<small class="text-black"><strong>{{ token.name }}</strong></small><br>
														<small class="text-muted" style="font-size: 0.7rem;">{{ token.x }}, {{ token.y }}</small>
													</div>
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Grid Settings Modal -->
			<battle-map-grid-settings
				ref="gridSettingsModal"
				:current-width="store.grid.width"
				:current-height="store.grid.height"
				:current-color="store.grid.gridColor"
				:current-grid-width="store.grid.gridWidth"
				:tokens="store.tokensList"
				@save="handleGridSizeChange">
			</battle-map-grid-settings>

			<!-- Token Dialog Modal -->
			<div v-if="tokenDialogVisible" class="modal fade show" style="display: block; background: rgba(0,0,0,0.5);" @click.self="tokenDialogVisible = false">
				<div class="modal-dialog">
					<div class="modal-content">
						<div class="modal-header">
							<h5 class="modal-title">
								{{ tokenDialogMode === 'add' ? $t('battlemap.addTokenDialog.title') : $t('battlemap.editTokenDialog.title') }}
							</h5>
							<button type="button" class="btn-close" @click="tokenDialogVisible = false"></button>
						</div>
						<div class="modal-body">
							<div class="mb-3">
								<label class="form-label">{{ $t('battlemap.tokenDialog.name') }}</label>
								<input type="text" class="form-control" v-model="tokenDialogData.name" />
							</div>

							<div class="mb-3">
								<label class="form-label">{{ $t('battlemap.tokenDialog.image') }}</label>
								<input type="file" class="form-control" accept="image/png,image/jpeg,image/jpg" @change="handleTokenImageSelect" />
								<small class="form-text text-muted">{{ $t('battlemap.tokenDialog.imageHint') }}</small>
							</div>

							<!-- Image Preview -->
							<div v-if="tokenDialogData.imagePreview" class="mb-3">
								<label class="form-label">{{ $t('battlemap.tokenDialog.preview') }}</label>
								<div class="position-relative d-inline-block">
									<img :src="tokenDialogData.imagePreview" style="max-width: 150px; max-height: 150px; border-radius: 8px;" />
									<button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0" @click="clearTokenImage">
										<i class="bi bi-x"></i>
									</button>
								</div>
							</div>

							<div class="row">
								<div class="col-6">
									<label class="form-label">{{ $t('battlemap.tokenDialog.color') }}</label>
									<input type="color" class="form-control form-control-color" v-model="tokenDialogData.color" />
									<small class="form-text text-muted">{{ $t('battlemap.tokenDialog.colorHint') }}</small>
								</div>
								<div class="col-6">
									<label class="form-label">{{ $t('battlemap.tokenDialog.size') }}</label>
									<input type="number" class="form-control" v-model.number="tokenDialogData.size" min="1" max="5" />
								</div>
							</div>

							<div class="form-check mt-3" v-if="isMaster">
								<input class="form-check-input" type="checkbox" v-model="tokenDialogData.isDmOnly" id="tokenDmOnly" />
								<label class="form-check-label" for="tokenDmOnly">
									{{ $t('battlemap.tokenDialog.dmOnly') }}
								</label>
							</div>
						</div>
						<div class="modal-footer">
							<button type="button" class="btn btn-secondary" @click="tokenDialogVisible = false">
								{{ $t('common.cancel') }}
							</button>
							<button type="button" class="btn btn-primary" @click="saveTokenDialog">
								{{ $t('common.save') }}
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	`,
	props: {
		sessionId: { type: String, required: true },
		userId: { type: String, required: true },
		isMaster: { type: Boolean, required: true },
		initialMap: { type: Object, required: true }
	},
	setup(props) {
		const { t } = useI18n()
		const store = useBattleMapStore()
		const connection = shallowRef(null)
		const currentTool = ref('select')
		const gridSettingsModal = ref(null)

		// Token dialog state
		const tokenDialogVisible = ref(false)
		const tokenDialogMode = ref('add') // 'add' or 'edit'
		const tokenDialogData = ref({
			id: null,
			name: '',
			color: '#3498db',
			size: 1,
			imageFile: null,
			imagePreview: null,
			isVisible: true,
			isDmOnly: false
		})

		async function initializeSignalR() {
			connection.value = new signalR.HubConnectionBuilder()
				.withUrl('/battleMapHub')
				.withAutomaticReconnect()
				.build()

			connection.value.on('InitialBattleMapState', (data) => {
				store.initializeMap(data.map)
			})

			connection.value.on('TokenMoved', (data) => {
				store.moveToken(data.tokenId, data.x, data.y)
			})

			connection.value.on('TokenAdded', (data) => {
				store.addToken(data.token)
			})

			connection.value.on('TokenRemoved', (data) => {
				store.removeToken(data.tokenId)
			})

			connection.value.on('TokenUpdated', (data) => {
				store.updateToken(data.tokenId, data.token)
			})

			connection.value.on('BackgroundUpdated', (data) => {
				store.updateBackground(data.imageUrl, data.scale, data.offsetX, data.offsetY, data.version)
			})

			connection.value.on('GridSizeUpdated', (data) => {
				store.updateGridSize(data.width, data.height, data.version)

				if (data.movedTokens && data.movedTokens.length > 0) {
					alert(t('battlemap.gridSettings.tokensMoved', { count: data.movedTokens.length }))
				}
			})

			connection.value.on('GridColorUpdated', (data) => {
				store.updateGridColor(data.color, data.version)
			})

			connection.value.on('GridWidthUpdated', (data) => {
				store.updateGridWidth(data.gridWidth, data.version)
			})

			connection.value.on('BattleMapError', (message) => {
				alert(message)
			})

			connection.value.onreconnected(async () => {
				await connection.value.invoke('JoinBattleMap', props.sessionId, props.userId)
			})

			try {
				await connection.value.start()
				await connection.value.invoke('JoinBattleMap', props.sessionId, props.userId)
			} catch (err) {
				console.error('SignalR connection error:', err)
			}
		}

		function showTokenDialog(mode, token) {
			tokenDialogMode.value = mode
			if (mode === 'edit' && token) {
				tokenDialogData.value = {
					id: token.id,
					name: token.name,
					color: token.color,
					size: token.size,
					imageFile: null,
					imagePreview: token.imageUrl,
					isVisible: token.isVisible,
					isDmOnly: token.isDmOnly
				}
			} else {
				// Reset for add mode
				tokenDialogData.value = {
					id: null,
					name: '',
					color: '#3498db',
					size: 1,
					imageFile: null,
					imagePreview: null,
					isVisible: true,
					isDmOnly: false
				}
			}
			tokenDialogVisible.value = true
		}

		function handleTokenImageSelect(event) {
			const file = event.target.files[0]
			if (!file) return

			// Validate file size (5MB max)
			if (file.size > 5 * 1024 * 1024) {
				alert(t('battlemap.errors.tokenImageTooLarge'))
				return
			}

			// Validate file type
			if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
				alert(t('battlemap.errors.invalidFileType'))
				return
			}

			tokenDialogData.value.imageFile = file

			// Create preview
			const reader = new FileReader()
			reader.onload = (e) => {
				tokenDialogData.value.imagePreview = e.target.result
			}
			reader.readAsDataURL(file)
		}

		function clearTokenImage() {
			tokenDialogData.value.imageFile = null
			tokenDialogData.value.imagePreview = null
		}

		async function saveTokenDialog() {
			if (!tokenDialogData.value.name.trim()) {
				alert(t('battlemap.errors.tokenNameRequired'))
				return
			}

			try {
				let imageUrl = tokenDialogData.value.imagePreview

				// Upload image if a new file was selected
				if (tokenDialogData.value.imageFile) {
					const tokenId = tokenDialogData.value.id || crypto.randomUUID()

					const formData = new FormData()
					formData.append('tokenImage', tokenDialogData.value.imageFile)

					const response = await fetch(
						`/session/UploadBattleMapTokenImage?sessionId=${props.sessionId}&tokenId=${tokenId}`,
						{
							method: 'POST',
							body: formData
						}
					)

					const result = await response.json()

					if (!result.success) {
						alert(result.error || t('battlemap.errors.uploadFailed'))
						return
					}

					imageUrl = result.imageUrl
				}

				if (tokenDialogMode.value === 'add') {
					// Add new token
					const tokenData = {
						name: tokenDialogData.value.name,
						x: 5,
						y: 5,
						size: tokenDialogData.value.size,
						color: tokenDialogData.value.color,
						imageUrl: imageUrl,
						isVisible: tokenDialogData.value.isVisible,
						isDmOnly: tokenDialogData.value.isDmOnly
					}

					await connection.value.invoke('AddToken', props.sessionId, props.userId, tokenData)
				} else {
					// Update existing token
					const updates = {
						name: tokenDialogData.value.name,
						color: tokenDialogData.value.color,
						size: tokenDialogData.value.size,
						imageUrl: imageUrl,
						isVisible: tokenDialogData.value.isVisible,
						isDmOnly: tokenDialogData.value.isDmOnly
					}

					await connection.value.invoke('UpdateToken', props.sessionId, props.userId, tokenDialogData.value.id, updates)
				}

				tokenDialogVisible.value = false
			} catch (err) {
				console.error('Error saving token:', err)
				alert(t('battlemap.errors.saveFailed'))
			}
		}

		async function handleAddToken() {
			showTokenDialog('add', null)
		}

		async function handleRemoveToken() {
			if (!store.selectedToken) return
			if (!confirm(t('battlemap.confirmRemove'))) return

			try {
				await connection.value.invoke('RemoveToken', props.sessionId, props.userId, store.selectedToken.id)
			} catch (err) {
				console.error('Error removing token:', err)
			}
		}

		function handleToolChanged(tool) {
			currentTool.value = tool
		}

		async function handleSaveMap() {
			try {
				// Maps are auto-saved on every change
				alert('Map is automatically saved!')
			} catch (err) {
				console.error('Error saving map:', err)
			}
		}

		async function handleUploadBackground() {
			// Create hidden file input
			const input = document.createElement('input')
			input.type = 'file'
			input.accept = 'image/png,image/jpeg,image/jpg'

			input.onchange = async (e) => {
				const file = e.target.files[0]
				if (!file) return

				// Validate size (10MB max)
				if (file.size > 20 * 1024 * 1024) {
					alert(t('battlemap.errors.fileTooLarge'))
					return
				}

				// Upload via FormData
				const formData = new FormData()
				formData.append('backgroundImage', file)

				try {
					const response = await fetch(`/session/UploadBattleMapBackground/${props.sessionId}`, {
						method: 'POST',
						body: formData
					})

					const result = await response.json()

					if (result.success) {
						// Broadcast via SignalR
						await connection.value.invoke('UpdateBackground', props.sessionId, props.userId, {
							imageUrl: result.imageUrl,
							scale: 1.0,
							offsetX: 0,
							offsetY: 0
						})
					} else {
						alert(result.error || t('battlemap.errors.uploadFailed'))
					}
				} catch (err) {
					console.error('Upload error:', err)
					alert(t('battlemap.errors.uploadFailed'))
				}
			}

			input.click()
		}

		async function handleRemoveBackground() {
			if (!confirm(t('battlemap.confirmRemoveBackground'))) return

			try {
				await fetch(`/session/RemoveBattleMapBackground/${props.sessionId}`, {
					method: 'POST'
				})

				await connection.value.invoke('UpdateBackground', props.sessionId, props.userId, {
					imageUrl: null,
					scale: 1.0,
					offsetX: 0,
					offsetY: 0
				})
			} catch (err) {
				console.error('Remove error:', err)
			}
		}

		function handleEditGridSize() {
			gridSettingsModal.value?.show()
		}

		async function handleGridSizeChange({ width, height, color, gridWidth }) {
			try {
				// Update dimensions if changed
				if (width !== store.grid.width || height !== store.grid.height) {
					await connection.value.invoke('UpdateGridSize', props.sessionId, props.userId, width, height)
				}

				// Update color if changed
				if (color !== store.grid.gridColor) {
					await connection.value.invoke('UpdateGridColor', props.sessionId, props.userId, color)
				}
				if (gridWidth != store.grid.gridWidth) {
					await connection.value.invoke('UpdateGridWidth', props.sessionId, props.userId, gridWidth)
				}

			} catch (err) {
				console.error('Grid size update error:', err)
			}
		}

		onMounted(() => {
			store.initializeMap(props.initialMap)
			initializeSignalR()
		})

		onUnmounted(async () => {
			if (connection.value) {
				await connection.value.invoke('LeaveBattleMap', props.sessionId, props.userId)
				await connection.value.stop()
			}
		})

		return {
			store,
			connection,
			currentTool,
			gridSettingsModal,
			tokenDialogVisible,
			tokenDialogMode,
			tokenDialogData,
			handleAddToken,
			handleRemoveToken,
			handleToolChanged,
			handleSaveMap,
			handleUploadBackground,
			handleRemoveBackground,
			handleEditGridSize,
			handleGridSizeChange,
			showTokenDialog,
			handleTokenImageSelect,
			clearTokenImage,
			saveTokenDialog
		}
	}
}
