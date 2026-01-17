import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

export default {
	name: 'LobbyChatPanel',
	template: `
		<div class="card shadow-sm h-100">
			<div class="card-header bg-dark text-white">
				<h5 class="mb-0">{{ $t('lobby.chat.title') }}</h5>
			</div>
			<div class="card-body p-0">
				<div ref="chatMessages" class="chat-messages p-3">
					<div v-if="chatHistory.length === 0" class="text-muted text-center">
						<small>{{ $t('lobby.chat.placeholder') }}</small>
					</div>
					<div v-for="(message, index) in chatHistory" :key="index" class="chat-message mb-2">
						<div v-if="message.isSystem" class="text-muted fst-italic">
							<small>{{ message.text }}</small>
						</div>
						<div v-else>
							<strong>{{ message.username }}:</strong>
							<span class="ms-2">{{ message.text }}</span>
							<small class="text-muted ms-2">{{ formatTime(message.timestamp) }}</small>
						</div>
					</div>
				</div>
			</div>
			<div class="card-footer">
				<div class="input-group">
					<input type="text" class="form-control" v-model="chatInput"
						   :placeholder="$t('lobby.chat.input')" maxlength="500"
						   @keyup.enter="sendMessage">
					<button class="btn btn-primary" type="button"
							:disabled="!chatInput.trim()"
							@click="sendMessage">
						{{ $t('lobby.chat.sendButton') }}
					</button>
				</div>
			</div>
		</div>
	`,
	props: {
		connection: {
			type: Object,
			required: true
		},
		sessionId: {
			type: String,
			required: true
		},
		userId: {
			type: String,
			required: true
		}
	},
	setup(props) {
		const { t } = useI18n()

		const chatHistory = ref([])
		const chatInput = ref('')
		const chatMessages = ref(null)

		function formatTime(timestamp) {
			const date = new Date(timestamp)
			return date.toLocaleTimeString()
		}

		function addSystemMessage(message) {
			chatHistory.value.push({
				text: message,
				timestamp: new Date().toISOString(),
				isSystem: true
			})
			scrollToBottom()
		}

		function addChatMessage(username, message, timestamp) {
			chatHistory.value.push({
				username,
				text: message,
				timestamp,
				isSystem: false
			})
			scrollToBottom()
		}

		async function scrollToBottom() {
			await nextTick()
			if (chatMessages.value) {
				chatMessages.value.scrollTop = chatMessages.value.scrollHeight
			}
		}

		async function sendMessage() {
			if (chatInput.value.trim()) {
				try {
					await props.connection.invoke('SendMessage', props.sessionId, props.userId, chatInput.value)
					chatInput.value = ''
				} catch (err) {
					console.error('Error sending message:', err)
				}
			}
		}

		function setupSignalRHandlers() {
			if (!props.connection) return

			props.connection.on('ReceiveMessage', (data) => {
				addChatMessage(data.username, data.message, data.timestamp)
			})

			props.connection.on('ChatHistory', (messages) => {
				chatHistory.value = messages.map(msg => ({
					username: msg.username,
					text: msg.message,
					timestamp: msg.timestamp,
					isSystem: false
				}))
				scrollToBottom()
			})
		}

		onMounted(() => {
			setupSignalRHandlers()
		})

		return {
			chatHistory,
			chatInput,
			chatMessages,
			formatTime,
			addSystemMessage,
			sendMessage
		}
	}
}
