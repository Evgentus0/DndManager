import { ref, onMounted, onUnmounted, shallowRef } from 'vue'
import { useBattleMapStore } from '../stores/useBattleMapStore.js'
import { useI18n } from 'vue-i18n'
import BattleMapCanvas from './BattleMapCanvas.js'
import BattleMapToolbar from './BattleMapToolbar.js'

export default {
	name: 'BattleMapContainer',
	components: {
		BattleMapCanvas,
		BattleMapToolbar
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
						@add-token="handleAddToken"
						@remove-token="handleRemoveToken"
						@tool-changed="handleToolChanged"
						@save-map="handleSaveMap">
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
											@click="store.setSelectedToken(token.id)">
											<div class="card-body p-2">
												<div class="d-flex align-items-center">
													<div class="me-2"
														:style="{width: '24px', height: '24px', borderRadius: '50%', backgroundColor: token.color, border: '2px solid #ecf0f1'}">
													</div>
													<div class="flex-grow-1">
														<small class="text-white"><strong>{{ token.name }}</strong></small><br>
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

		async function handleAddToken() {
			const name = prompt(t('battlemap.promptTokenName'))
			if (!name) return

			const tokenData = {
				name: name,
				x: 5,
				y: 5,
				size: 1,
				color: '#3498db',
				isVisible: true,
				isDmOnly: false
			}

			try {
				await connection.value.invoke('AddToken', props.sessionId, props.userId, tokenData)
			} catch (err) {
				console.error('Error adding token:', err)
			}
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
			handleAddToken,
			handleRemoveToken,
			handleToolChanged,
			handleSaveMap
		}
	}
}
