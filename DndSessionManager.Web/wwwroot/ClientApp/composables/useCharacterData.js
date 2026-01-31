import { ref, computed, onUnmounted } from 'vue'

// =============================================================================
// SINGLETON STATE - Shared across all component instances
// =============================================================================

// Shared reactive state
const characters = ref([])
const races = ref([])
const classes = ref([])
const skills = ref([])
const equipmentList = ref([])
const spellsList = ref([])
const featuresList = ref([])
const traitsList = ref([])
const languagesList = ref([])

// Initialization tracking
let isInitialized = false
let isInitializing = null // Promise when in progress
let activeInstanceCount = 0

// Store handler references for cleanup
let currentConnection = null
const handlerRefs = {
	CharacterList: null,
	CharacterCreated: null,
	CharacterUpdated: null,
	CharacterDeleted: null,
	CharacterError: null,
	CharacterEquipmentUpdated: null,
	CharacterSpellSlotsUpdated: null,
	CharacterHPUpdated: null,
	CharacterCoinsUpdated: null
}

export function useCharacterData(props) {
	// Increment instance counter
	activeInstanceCount++

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

	function languageLink(languageIndex) {
		return `/handbook?category=languages&index=${languageIndex}`
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

	async function updateHP(char, delta) {
		const newHP = Math.max(0, Math.min(char.maxHitPoints, (char.currentHitPoints || 0) + delta))
		try {
			await props.connection.invoke('UpdateCharacterHP',
				props.sessionId, props.userId, char.id, newHP)
		} catch (err) {
			console.error('Error updating HP:', err)
		}
	}

	async function updateCoins(char, coinType, delta) {
		const newValues = {
			cp: char.copperPieces || 0,
			sp: char.silverPieces || 0,
			ep: char.electrumPieces || 0,
			gp: char.goldPieces || 0,
			pp: char.platinumPieces || 0
		}

		const key = coinType.toLowerCase()
		newValues[key] = Math.max(0, newValues[key] + delta)

		try {
			await props.connection.invoke('UpdateCharacterCoins',
				props.sessionId, props.userId, char.id,
				newValues.cp, newValues.sp, newValues.ep, newValues.gp, newValues.pp)
		} catch (err) {
			console.error('Error updating coins:', err)
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
			const [racesRes, classesRes, skillsRes, equipmentRes, spellsRes, featuresRes, traitsRes, languagesRes] = await Promise.all([
				fetch('/api/handbook/races', { headers: { 'X-Locale': defaultLanguage } }),
				fetch('/api/handbook/classes', { headers: { 'X-Locale': defaultLanguage } }),
				fetch('/api/handbook/skills', { headers: { 'X-Locale': defaultLanguage } }),
				fetch('/api/handbook/equipment', { headers: { 'X-Locale': defaultLanguage } }),
				fetch('/api/handbook/spells', { headers: { 'X-Locale': defaultLanguage } }),
				fetch('/api/handbook/features', { headers: { 'X-Locale': defaultLanguage } }),
				fetch('/api/handbook/traits', { headers: { 'X-Locale': defaultLanguage } }),
			fetch('/api/handbook/languages', { headers: { 'X-Locale': defaultLanguage } })
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
		if (languagesRes.ok) {
			languagesList.value = await languagesRes.json()
		}
	} catch (err) {
			console.error('Error fetching handbook data:', err)
		}
	}

	function setupSignalRHandlers(connection) {
		if (!connection) return

		// Store connection reference for cleanup
		currentConnection = connection

		// Create handler functions and store references
		handlerRefs.CharacterList = (characterList) => {
			characters.value = characterList
		}

		handlerRefs.CharacterCreated = (character) => {
			const existingIndex = characters.value.findIndex(c => c.id === character.id)
			if (existingIndex === -1) {
				characters.value.push(character)
			}
		}

		handlerRefs.CharacterUpdated = (character) => {
			const index = characters.value.findIndex(c => c.id === character.id)
			if (index !== -1) {
				characters.value[index] = character
			}
		}

		handlerRefs.CharacterDeleted = (characterId) => {
			characters.value = characters.value.filter(c => c.id !== characterId)
		}

		handlerRefs.CharacterError = (message) => {
			alert(message)
		}

		handlerRefs.CharacterEquipmentUpdated = (data) => {
			const char = characters.value.find(c => c.id === data.characterId)
			if (char) {
				char.equipment = data.equipment
			}
		}

		handlerRefs.CharacterSpellSlotsUpdated = (data) => {
			const char = characters.value.find(c => c.id === data.characterId)
			if (char) {
				char.spellSlots = data.spellSlots
			}
		}

		handlerRefs.CharacterHPUpdated = (data) => {
			const char = characters.value.find(c => c.id === data.characterId)
			if (char) {
				char.currentHitPoints = data.currentHitPoints
			}
		}

		handlerRefs.CharacterCoinsUpdated = (data) => {
			const char = characters.value.find(c => c.id === data.characterId)
			if (char) {
				char.copperPieces = data.copperPieces
				char.silverPieces = data.silverPieces
				char.electrumPieces = data.electrumPieces
				char.goldPieces = data.goldPieces
				char.platinumPieces = data.platinumPieces
			}
		}

		// Register all handlers
		Object.entries(handlerRefs).forEach(([eventName, handler]) => {
			connection.on(eventName, handler)
		})
	}

	function cleanupSignalRHandlers() {
		if (!currentConnection) return

		// Unregister all handlers
		Object.entries(handlerRefs).forEach(([eventName, handler]) => {
			if (handler) {
				currentConnection.off(eventName, handler)
			}
		})

		// Clear references
		currentConnection = null
		Object.keys(handlerRefs).forEach(key => {
			handlerRefs[key] = null
		})

		// Reset initialization state
		isInitialized = false
		isInitializing = null
	}

	async function init(connection) {
		// Guard: Already fully initialized
		if (isInitialized) {
			return
		}

		// Guard: Currently initializing - return existing promise
		if (isInitializing) {
			return isInitializing
		}

		// Start initialization
		isInitializing = (async () => {
			try {
				// Setup handlers first
				setupSignalRHandlers(connection)

				// Fetch static handbook data
				await fetchHandbookData()

				// Mark as initialized
				isInitialized = true
			} catch (error) {
				console.error('Error during character data initialization:', error)
				// Reset on error so it can be retried
				isInitialized = false
				cleanupSignalRHandlers()
				throw error
			} finally {
				isInitializing = null
			}
		})()

		return isInitializing
	}

	// Setup cleanup on component unmount
	onUnmounted(() => {
		activeInstanceCount--

		// Only cleanup when last instance unmounts
		if (activeInstanceCount === 0) {
			cleanupSignalRHandlers()
		}
	})

	return {
		characters,
		races,
		classes,
		skills,
		equipmentList,
		spellsList,
		featuresList,
		traitsList,
		languagesList,
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
		languageLink,
		getEquipmentDamage,
		ammoClass,
		updateAmmo,
		updateHP,
		updateCoins,
		useSpellSlot,
		init: () => init(props.connection)
	}
}
