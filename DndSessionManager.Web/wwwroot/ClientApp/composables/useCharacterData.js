import { ref, computed, onMounted } from 'vue'

export function useCharacterData(props) {
	const characters = ref([])
	const races = ref([])
	const classes = ref([])
	const skills = ref([])
	const equipmentList = ref([])
	const spellsList = ref([])
	const featuresList = ref([])
	const traitsList = ref([])

	const myCharacter = computed(() => {
		return characters.value.find(c => c.ownerId === props.userId)
	})

	function getModifier(score) {
		const mod = Math.floor((score - 10) / 2)
		return mod >= 0 ? `+${mod}` : `${mod}`
	}

	function raceLink(char) {
		return `/handbook?category=races&index=${char.raceIndex}`
	}

	function classLink(char) {
		return `/handbook?category=classes&index=${char.classIndex}`
	}

	function abilityLink(abilityIndex) {
		return `/handbook?category=abilityScores&index=${abilityIndex}`
	}

	function skillLink(skillIndex) {
		return `/handbook?category=skills&index=${skillIndex}`
	}

	function getSkillsForAbility(char, abilityIndex) {
		if (!char.skills || char.skills.length === 0) return []
		return skills.value.filter(skill => {
			const skillAbility = skill.additionalData?.ability_score?.index ||
				skill.ability_score?.index
			return skillAbility === abilityIndex && char.skills.includes(skill.index)
		})
	}

	function equipmentLink(equipmentIndex) {
		return `/handbook?category=equipment&index=${equipmentIndex}`
	}

	function spellLink(spellIndex) {
		return `/handbook?category=spells&index=${spellIndex}`
	}

	function featureLink(featureIndex) {
		return `/handbook?category=features&index=${featureIndex}`
	}

	function traitLink(traitIndex) {
		return `/handbook?category=traits&index=${traitIndex}`
	}

	function getEquipmentDamage(equipmentIndex) {
		const item = equipmentList.value.find(e => e.index === equipmentIndex)
		if (!item) return null
		const dmg = item.damage || item.additionalData?.damage
		if (!dmg) return null
		return `${dmg.damage_dice} ${dmg.damage_type?.name || ''}`
	}

	function ammoClass(ammo) {
		if (ammo === 0) return 'bg-danger'
		if (ammo <= 5) return 'bg-warning text-dark'
		return 'bg-secondary'
	}

	async function updateAmmo(char, item, delta) {
		const newCount = Math.max(0, (item.currentAmmo || 0) + delta)
		try {
			await props.connection.invoke('UpdateEquipmentAmmo',
				props.sessionId, props.userId, char.id, item.id, newCount)
		} catch (err) {
			console.error('Error updating ammo:', err)
		}
	}

	async function useSpellSlot(char, slotLevel, delta) {
		const slot = char.spellSlots?.find(s => s.level === slotLevel)
		if (!slot) return
		const newUsed = Math.max(0, Math.min(slot.total, (slot.used || 0) + delta))
		try {
			await props.connection.invoke('UseSpellSlot',
				props.sessionId, props.userId, char.id, slotLevel, newUsed)
		} catch (err) {
			console.error('Error using spell slot:', err)
		}
	}

	async function fetchHandbookData() {
		try {
			const savedLanguage = localStorage.getItem('user-language')
			const browserLanguage = navigator.language.split('-')[0]
			const defaultLanguage = savedLanguage || (browserLanguage === 'ru' ? 'ru' : 'en')
			const [racesRes, classesRes, skillsRes, equipmentRes, spellsRes, featuresRes, traitsRes] = await Promise.all([
				fetch('/api/handbook/races', { headers: { 'X-Locale': defaultLanguage } }),
				fetch('/api/handbook/classes', { headers: { 'X-Locale': defaultLanguage } }),
				fetch('/api/handbook/skills', { headers: { 'X-Locale': defaultLanguage } }),
				fetch('/api/handbook/equipment', { headers: { 'X-Locale': defaultLanguage } }),
				fetch('/api/handbook/spells', { headers: { 'X-Locale': defaultLanguage } }),
				fetch('/api/handbook/features', { headers: { 'X-Locale': defaultLanguage } }),
				fetch('/api/handbook/traits', { headers: { 'X-Locale': defaultLanguage } })
			])

			if (racesRes.ok) {
				races.value = await racesRes.json()
			}
			if (classesRes.ok) {
				classes.value = await classesRes.json()
			}
			if (skillsRes.ok) {
				skills.value = await skillsRes.json()
			}
			if (equipmentRes.ok) {
				equipmentList.value = await equipmentRes.json()
			}
			if (spellsRes.ok) {
				spellsList.value = await spellsRes.json()
			}
			if (featuresRes.ok) {
				featuresList.value = await featuresRes.json()
			}
			if (traitsRes.ok) {
				traitsList.value = await traitsRes.json()
			}
		} catch (err) {
			console.error('Error fetching handbook data:', err)
		}
	}

	function setupSignalRHandlers() {
		if (!props.connection) return

		props.connection.on('CharacterList', (characterList) => {
			characters.value = characterList
		})

		props.connection.on('CharacterCreated', (character) => {
			const existingIndex = characters.value.findIndex(c => c.id === character.id)
			if (existingIndex === -1) {
				characters.value.push(character)
			}
		})

		props.connection.on('CharacterUpdated', (character) => {
			const index = characters.value.findIndex(c => c.id === character.id)
			if (index !== -1) {
				characters.value[index] = character
			}
		})

		props.connection.on('CharacterDeleted', (characterId) => {
			characters.value = characters.value.filter(c => c.id !== characterId)
		})

		props.connection.on('CharacterError', (message) => {
			alert(message)
		})

		props.connection.on('CharacterEquipmentUpdated', (data) => {
			const char = characters.value.find(c => c.id === data.characterId)
			if (char) {
				char.equipment = data.equipment
			}
		})

		props.connection.on('CharacterSpellSlotsUpdated', (data) => {
			const char = characters.value.find(c => c.id === data.characterId)
			if (char) {
				char.spellSlots = data.spellSlots
			}
		})
	}

	function init() {
		setupSignalRHandlers()
		fetchHandbookData()
	}

	return {
		characters,
		races,
		classes,
		skills,
		equipmentList,
		spellsList,
		featuresList,
		traitsList,
		myCharacter,
		getModifier,
		raceLink,
		classLink,
		abilityLink,
		skillLink,
		getSkillsForAbility,
		equipmentLink,
		spellLink,
		featureLink,
		traitLink,
		getEquipmentDamage,
		ammoClass,
		updateAmmo,
		useSpellSlot,
		init
	}
}
