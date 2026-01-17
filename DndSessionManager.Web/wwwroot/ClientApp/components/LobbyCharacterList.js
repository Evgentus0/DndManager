import { useI18n } from 'vue-i18n'

export default {
	name: 'LobbyCharacterList',
	template: `
		<div class="card shadow-sm h-100">
			<div class="card-header bg-dark text-white">
				<h5 class="mb-0">{{ $t('lobby.tabs.characters') }}</h5>
			</div>
			<div class="card-body d-flex align-items-center justify-content-center">
				<div class="text-muted text-center">
					<i class="bi bi-people fs-1 mb-3 d-block"></i>
					<p>{{ $t('lobby.characters.placeholder') }}</p>
				</div>
			</div>
		</div>
	`,
	setup() {
		const { t } = useI18n()
		return { t }
	}
}
