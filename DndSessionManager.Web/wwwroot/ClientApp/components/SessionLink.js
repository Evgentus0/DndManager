import { ref, computed, onMounted, onUnmounted, inject } from 'vue'
import { useI18n } from 'vue-i18n'

export default {
	name: 'SessionLink',
	template: `
	<a v-if="hasSession"
	   :href="sessionUrl"
	   class="btn btn-outline-success btn-sm text-nowrap">
		<i class="bi bi-controller me-1"></i>
		<span class="d-none d-md-inline">{{ sessionName }}</span>
		<span class="d-md-none">{{ $t('nav.currentSession') }}</span>
	</a>
	`,
	setup() {
		const { t } = useI18n()

		const sessionId = ref(null)
		const sessionName = ref('')

		const sessionData = inject('sessionData');
		if (sessionData) {
			sessionId.value = sessionData.sessionId;
			sessionName.value = sessionData.sessionName;
		}

		const sessionUrl = computed(() => {
			return sessionId.value ? `/Session/Lobby/${sessionId.value}` : '#'
		})
		const hasSession = computed(() => {
			return sessionId.value ? true : false;
		})

		function clearSession() {
			hasSession.value = false
			sessionId.value = null
			sessionName.value = ''
		}

		return {
			hasSession,
			sessionName,
			sessionUrl
		}
	}
}
