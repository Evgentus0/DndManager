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

				<!-- Additional actions -->
				<div class="btn-group" role="group" v-if="isMaster">
					<button
						type="button"
						class="btn btn-sm btn-outline-light"
						@click="$emit('save-map')"
						:title="$t('battlemap.actions.save')">
						<i class="bi bi-save"></i> {{ $t('battlemap.actions.save') }}
					</button>
				</div>
			</div>
		</div>
	`,
	props: {
		isMaster: { type: Boolean, required: true },
		canRemove: { type: Boolean, default: false }
	},
	emits: ['add-token', 'remove-token', 'tool-changed', 'save-map'],
	setup(props, { emit }) {
		const { t } = useI18n()

		const selectedTool = ref('select')

		function selectTool(tool) {
			selectedTool.value = tool
			emit('tool-changed', tool)
		}

		return {
			selectedTool,
			selectTool
		}
	}
}
