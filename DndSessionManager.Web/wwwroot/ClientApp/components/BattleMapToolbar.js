import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

export default {
	name: 'BattleMapToolbar',
	template: `
		<div class="battle-map-toolbar">
			<div class="btn-toolbar" role="toolbar">
				<!-- Main actions -->
				<div class="btn-group me-2" role="group">
					<button
						type="button"
						class="btn btn-sm"
						:class="selectedTool === 'select' ? 'btn-primary' : 'btn-outline-light'"
						@click="selectTool('select')"
						:title="$t('battlemap.tools.select')">
						<i class="bi bi-cursor"></i> {{ $t('battlemap.tools.select') }}
					</button>
					<button
						v-if="isMaster"
						type="button"
						class="btn btn-sm"
						:class="selectedTool === 'wall' ? 'btn-primary' : 'btn-outline-light'"
						@click="selectTool('wall')"
						:title="$t('battlemap.tools.wall')">
						<i class="bi bi-bricks"></i> {{ $t('battlemap.tools.wall') }}
					</button>
					<button
						v-if="isMaster"
						type="button"
						class="btn btn-sm"
						:class="selectedTool === 'fog' ? 'btn-primary' : 'btn-outline-light'"
						@click="selectTool('fog')"
						:title="$t('battlemap.tools.fog')">
						<i class="bi bi-cloud-fog"></i> {{ $t('battlemap.tools.fog') }}
					</button>
				</div>

				<!-- Token actions -->
				<div class="btn-group me-2" role="group" v-if="isMaster">
					<button
						type="button"
						class="btn btn-sm btn-success"
						@click="$emit('add-token')"
						:title="$t('battlemap.actions.addToken')">
						<i class="bi bi-plus-circle"></i> {{ $t('battlemap.actions.addToken') }}
					</button>
					<button
						type="button"
						class="btn btn-sm btn-danger"
						@click="$emit('remove-token')"
						:disabled="!canRemove"
						:title="$t('battlemap.actions.removeToken')">
						<i class="bi bi-trash"></i> {{ $t('battlemap.actions.removeToken') }}
					</button>
				</div>

				<!-- Wall type selector (only visible when wall tool is active) -->
				<div class="btn-group me-2" role="group" v-if="selectedTool === 'wall' && isMaster">
					<button
						type="button"
						class="btn btn-sm"
						:class="wallType === 'Solid' ? 'btn-danger' : 'btn-outline-danger'"
						@click="setWallType('Solid')"
						:title="$t('battlemap.wallTypes.solid')">
						<i class="bi bi-dash-lg"></i> {{ $t('battlemap.wallTypes.solid') }}
					</button>
					<button
						type="button"
						class="btn btn-sm"
						:class="wallType === 'Window' ? 'btn-warning' : 'btn-outline-warning'"
						@click="setWallType('Window')"
						:title="$t('battlemap.wallTypes.window')">
						<i class="bi bi-dash-lg"></i> {{ $t('battlemap.wallTypes.window') }}
					</button>
				</div>

				<!-- Fog tool options (only visible when fog tool is active) -->
				<div class="btn-group me-2" role="group" v-if="selectedTool === 'fog' && isMaster">
					<button
						type="button"
						class="btn btn-sm"
						:class="fogMode === 'reveal' ? 'btn-success' : 'btn-outline-success'"
						@click="setFogMode('reveal')"
						:title="$t('battlemap.fogModes.reveal')">
						<i class="bi bi-eye"></i> {{ $t('battlemap.fogModes.reveal') }}
					</button>
					<button
						type="button"
						class="btn btn-sm"
						:class="fogMode === 'shroud' ? 'btn-dark' : 'btn-outline-dark'"
						@click="setFogMode('shroud')"
						:title="$t('battlemap.fogModes.shroud')">
						<i class="bi bi-eye-slash"></i> {{ $t('battlemap.fogModes.shroud') }}
					</button>
				</div>

				<!-- Additional actions -->
				<div class="btn-group" role="group" v-if="isMaster">
					<button
						type="button"
						class="btn btn-sm"
						:class="fogEnabled ? 'btn-info' : 'btn-outline-info'"
						@click="$emit('toggle-fog')"
						:title="fogEnabled ? $t('battlemap.actions.disableFog') : $t('battlemap.actions.enableFog')">
						<i :class="fogEnabled ? 'bi bi-cloud-fog-fill' : 'bi bi-cloud-fog'"></i>
						{{ fogEnabled ? $t('battlemap.actions.disableFog') : $t('battlemap.actions.enableFog') }}
					</button>
					<button
						type="button"
						class="btn btn-sm btn-outline-light"
						@click="$emit('clear-walls')"
						:title="$t('battlemap.actions.clearWalls')">
						<i class="bi bi-eraser"></i> {{ $t('battlemap.actions.clearWalls') }}
					</button>
					<button
						type="button"
						class="btn btn-sm btn-outline-light"
						@click="$emit('save-map')"
						:title="$t('battlemap.actions.save')">
						<i class="bi bi-save"></i> {{ $t('battlemap.actions.save') }}
					</button>
				</div>

				<!-- Instructions -->
				<div class="ms-3 align-self-center" v-if="selectedTool === 'wall'">
					<small class="text-white-50">
						<i class="bi bi-info-circle"></i> {{ $t('battlemap.instructions.wall') }}
					</small>
				</div>
				<div class="ms-3 align-self-center" v-if="selectedTool === 'fog'">
					<small class="text-white-50">
						<i class="bi bi-info-circle"></i> {{ $t('battlemap.instructions.fog') }}
					</small>
				</div>
			</div>

			<!-- Tool info badge -->
			<div class="mt-2" v-if="selectedTool !== 'select'">
				<span class="badge bg-info">
					<i class="bi bi-hand-index"></i>
					<span v-if="selectedTool === 'wall'">{{ $t('battlemap.toolInfo.wall') }}</span>
					<span v-if="selectedTool === 'fog'">{{ $t('battlemap.toolInfo.fog') }}</span>
				</span>
			</div>
		</div>
	`,
	props: {
		isMaster: { type: Boolean, required: true },
		canRemove: { type: Boolean, default: false },
		fogEnabled: { type: Boolean, default: false }
	},
	emits: ['add-token', 'remove-token', 'tool-changed', 'wall-type-changed', 'fog-mode-changed', 'toggle-fog', 'clear-walls', 'save-map'],
	setup(props, { emit }) {
		const { t } = useI18n()

		const selectedTool = ref('select')
		const wallType = ref('Solid')
		const fogMode = ref('reveal') // 'reveal' or 'shroud'

		function selectTool(tool) {
			selectedTool.value = tool
			emit('tool-changed', tool)
		}

		function setWallType(type) {
			wallType.value = type
			emit('wall-type-changed', type)
		}

		function setFogMode(mode) {
			fogMode.value = mode
			emit('fog-mode-changed', mode)
		}

		return {
			selectedTool,
			wallType,
			fogMode,
			selectTool,
			setWallType,
			setFogMode
		}
	}
}
