import { useI18n } from 'vue-i18n'

export default {
	name: 'TabNavigation',
	template: `
		<ul class="nav nav-tabs mb-4">
			<li class="nav-item" v-for="tab in tabs" :key="tab.value">
				<a
					class="nav-link"
					:class="{ active: currentTab === tab.value }"
					href="#"
					@click.prevent="selectTab(tab.value)">
					{{ $t('handbook.tabs.' + tab.value) }}
				</a>
			</li>
		</ul>
	`,
	props: {
		currentTab: {
			type: String,
			required: true
		}
	},
	emits: ['tab-changed'],
	setup(props, { emit }) {
		const { t } = useI18n()

		const tabs = [
			{ value: 'spells' },
			{ value: 'monsters' },
			{ value: 'classes' },
			{ value: 'subclasses' },
			{ value: 'equipment' },
			{ value: 'magicItems' },
			{ value: 'features' },
			{ value: 'races' },
			{ value: 'traits' },
			{ value: 'languages' },
			{ value: 'conditions' },
			{ value: 'skills' }
		]

		function selectTab(tabValue) {
			emit('tab-changed', tabValue)
		}

		return { tabs, selectTab, t }
	}
}
