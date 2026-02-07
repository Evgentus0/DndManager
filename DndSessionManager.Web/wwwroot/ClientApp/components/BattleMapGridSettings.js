import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

export default {
	name: 'BattleMapGridSettings',
	template: `
		<div class="modal fade" ref="modalRef" tabindex="-1">
			<div class="modal-dialog">
				<div class="modal-content">
					<div class="modal-header">
						<h5 class="modal-title">{{ $t('battlemap.gridSettings.title') }}</h5>
						<button type="button" class="btn-close" data-bs-dismiss="modal"></button>
					</div>
					<div class="modal-body">
						<div class="mb-3">
							<label class="form-label">{{ $t('battlemap.gridSettings.width') }}</label>
							<input
								type="number"
								class="form-control"
								v-model.number="localWidth"
								min="5"
								max="100">
						</div>
						<div class="mb-3">
							<label class="form-label">{{ $t('battlemap.gridSettings.height') }}</label>
							<input
								type="number"
								class="form-control"
								v-model.number="localHeight"
								min="5"
								max="100">
						</div>
						<div class="alert alert-warning" v-if="willMoveTokens">
							<i class="bi bi-exclamation-triangle"></i>
							{{ $t('battlemap.gridSettings.tokenWarning') }}
						</div>
					</div>
					<div class="modal-footer">
						<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
							{{ $t('common.cancel') }}
						</button>
						<button type="button" class="btn btn-primary" @click="handleSave">
							{{ $t('common.save') }}
						</button>
					</div>
				</div>
			</div>
		</div>
	`,
	props: {
		currentWidth: { type: Number, required: true },
		currentHeight: { type: Number, required: true },
		tokens: { type: Array, default: () => [] }
	},
	emits: ['save'],
	setup(props, { emit }) {
		const { t } = useI18n()
		const modalRef = ref(null)
		const localWidth = ref(props.currentWidth)
		const localHeight = ref(props.currentHeight)
		let modalInstance = null

		const willMoveTokens = computed(() => {
			return props.tokens.some(t =>
				t.x >= localWidth.value || t.y >= localHeight.value
			)
		})

		function show() {
			localWidth.value = props.currentWidth
			localHeight.value = props.currentHeight
			if (modalRef.value) {
				modalInstance = new bootstrap.Modal(modalRef.value)
				modalInstance.show()
			}
		}

		function hide() {
			if (modalInstance) {
				modalInstance.hide()
			}
		}

		function handleSave() {
			emit('save', { width: localWidth.value, height: localHeight.value })
			hide()
		}

		onMounted(() => {
			if (modalRef.value) {
				modalRef.value.addEventListener('hidden.bs.modal', () => {
					modalInstance = null
				})
			}
		})

		return {
			modalRef,
			localWidth,
			localHeight,
			willMoveTokens,
			show,
			hide,
			handleSave
		}
	}
}
