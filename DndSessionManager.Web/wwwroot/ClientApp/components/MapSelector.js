import { computed } from 'vue'
import { useBattleMapStore } from '../stores/useBattleMapStore.js'

export default {
	name: 'MapSelector',
	props: {
		isMaster: Boolean,
		sessionId: String,
		userId: String,
		connection: Object
	},
	setup(props) {
		const store = useBattleMapStore()

		const activeMap = computed(() =>
			store.availableMaps.find(m => m.id === store.activeMapId)
		)

		async function switchMap(mapId) {
			if (!props.isMaster || mapId === store.activeMapId) return

			try {
				await props.connection.invoke('SwitchMap', props.sessionId, props.userId, mapId)
			} catch (err) {
				console.error('Failed to switch map:', err)
			}
		}

		async function createMap() {
			if (!props.isMaster) return

			const name = prompt('Enter map name:')
			if (!name) return

			try {
				await props.connection.invoke('CreateMap', props.sessionId, props.userId, name)
			} catch (err) {
				console.error('Failed to create map:', err)
			}
		}

		async function renameMap(mapId) {
			if (!props.isMaster) return

			const map = store.availableMaps.find(m => m.id === mapId)
			const newName = prompt('Enter new name:', map?.name)
			if (!newName) return

			try {
				await props.connection.invoke('RenameMap', props.sessionId, props.userId, mapId, newName)
			} catch (err) {
				console.error('Failed to rename map:', err)
			}
		}

		async function deleteMap(mapId) {
			if (!props.isMaster) return
			if (store.availableMaps.length <= 1) {
				alert('Cannot delete the only map')
				return
			}

			if (!confirm('Delete this map? All creatures and walls will be lost.')) return

			try {
				await props.connection.invoke('DeleteMap', props.sessionId, props.userId, mapId)
			} catch (err) {
				console.error('Failed to delete map:', err)
			}
		}

		return { store, activeMap, switchMap, createMap, renameMap, deleteMap }
	},
	template: `
		<div class="map-selector card bg-dark text-white mb-3">
			<div class="card-body p-2">
				<div class="d-flex align-items-center justify-content-between">
					<div class="d-flex align-items-center gap-2 flex-grow-1">
						<label class="mb-0 me-2">
							<i class="bi bi-map"></i> {{ $t('battlemap.currentMap') }}:
						</label>
						<select
							class="form-select form-select-sm"
							style="max-width: 200px;"
							:value="store.activeMapId"
							@change="switchMap($event.target.value)"
							:disabled="!isMaster">
							<option
								v-for="map in store.availableMaps"
								:key="map.id"
								:value="map.id">
								{{ map.name }}
							</option>
						</select>

						<button
							v-if="isMaster && activeMap"
							class="btn btn-sm btn-outline-light"
							@click="renameMap(activeMap.id)"
							:title="$t('battlemap.renameMap')">
							<i class="bi bi-pencil"></i>
						</button>
					</div>

					<div v-if="isMaster" class="d-flex gap-2">
						<button
							class="btn btn-sm btn-success"
							@click="createMap"
							:title="$t('battlemap.createMap')">
							<i class="bi bi-plus-circle"></i> {{ $t('battlemap.newMap') }}
						</button>

						<button
							v-if="store.availableMaps.length > 1"
							class="btn btn-sm btn-danger"
							@click="deleteMap(store.activeMapId)"
							:title="$t('battlemap.deleteMap')">
							<i class="bi bi-trash"></i>
						</button>
					</div>
				</div>
			</div>
		</div>
	`
}
