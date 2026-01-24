export default {
	name: 'CharacterCard',
	template: `
		<div class="card" :class="{ 'border-primary': isHighlighted }">
			<div class="card-body">
				<div class="d-flex justify-content-between align-items-start">
					<div>
						<h5 class="card-title mb-1">
							{{ character.name }}
							<span v-if="character.isClaimed" class="badge bg-success ms-1" :title="$t('lobby.character.claimed')">
								<i class="bi bi-shield-lock"></i>
							</span>
							<span v-else class="badge bg-secondary ms-1" :title="$t('lobby.character.unclaimed')">
								<i class="bi bi-shield"></i>
							</span>
						</h5>
						<p class="card-text text-muted mb-2">
							<a v-if="character.raceIndex" :href="raceLink(character)" class="text-decoration-none">
								{{ character.raceName }}
							</a>
							<span v-else>{{ character.raceName }}</span>
							&bull;
							<a v-if="character.classIndex" :href="classLink(character)" class="text-decoration-none">
								{{ character.className }}
							</a>
							<span v-else>{{ character.className }}</span>
							&bull;
							{{ $t('lobby.character.form.level') }} {{ character.level }}
						</p>
						<p v-if="showOwner && character.ownerUsername" class="card-text small text-muted mb-0">
							<i class="bi bi-person"></i> {{ character.ownerUsername }}
							<span v-if="isOwnerOnline" class="badge bg-success ms-1">{{ $t('lobby.character.online') }}</span>
						</p>
					</div>
					<div v-if="showEditButtons" class="btn-group">
						<button class="btn btn-sm btn-outline-primary" @click="$emit('edit', character)">
							<i class="bi bi-pencil"></i>
						</button>
						<button class="btn btn-sm btn-outline-danger" @click="$emit('delete', character)">
							<i class="bi bi-trash"></i>
						</button>
						<button v-if="showResetPassword" class="btn btn-sm btn-outline-warning"
							@click="$emit('reset-password', character)"
							:title="$t('lobby.character.resetPassword')">
							<i class="bi bi-key"></i>
						</button>
					</div>
				</div>

				<div v-if="showFullStats" class="mt-3">
					<div class="row g-2 mb-2">
						<div class="col-4 col-md-2">
							<div class="text-center border rounded p-2">
								<div class="small">
									<a :href="abilityLink('str')" class="text-muted text-decoration-none">{{ $t('lobby.character.form.str') }}</a>
								</div>
								<div class="fw-bold">{{ character.strength }}</div>
								<div class="small text-muted">({{ getModifier(character.strength) }})</div>
								<div v-if="getSkillsForAbility(character, 'str').length > 0" class="mt-1">
									<a v-for="skill in getSkillsForAbility(character, 'str')" :key="skill.index"
										:href="skillLink(skill.index)"
										class="badge bg-secondary text-decoration-none d-block mb-1 small">
										{{ skill.name }}
									</a>
								</div>
							</div>
						</div>
						<div class="col-4 col-md-2">
							<div class="text-center border rounded p-2">
								<div class="small">
									<a :href="abilityLink('dex')" class="text-muted text-decoration-none">{{ $t('lobby.character.form.dex') }}</a>
								</div>
								<div class="fw-bold">{{ character.dexterity }}</div>
								<div class="small text-muted">({{ getModifier(character.dexterity) }})</div>
								<div v-if="getSkillsForAbility(character, 'dex').length > 0" class="mt-1">
									<a v-for="skill in getSkillsForAbility(character, 'dex')" :key="skill.index"
										:href="skillLink(skill.index)"
										class="badge bg-secondary text-decoration-none d-block mb-1 small">
										{{ skill.name }}
									</a>
								</div>
							</div>
						</div>
						<div class="col-4 col-md-2">
							<div class="text-center border rounded p-2">
								<div class="small">
									<a :href="abilityLink('con')" class="text-muted text-decoration-none">{{ $t('lobby.character.form.con') }}</a>
								</div>
								<div class="fw-bold">{{ character.constitution }}</div>
								<div class="small text-muted">({{ getModifier(character.constitution) }})</div>
								<div v-if="getSkillsForAbility(character, 'con').length > 0" class="mt-1">
									<a v-for="skill in getSkillsForAbility(character, 'con')" :key="skill.index"
										:href="skillLink(skill.index)"
										class="badge bg-secondary text-decoration-none d-block mb-1 small">
										{{ skill.name }}
									</a>
								</div>
							</div>
						</div>
						<div class="col-4 col-md-2">
							<div class="text-center border rounded p-2">
								<div class="small">
									<a :href="abilityLink('int')" class="text-muted text-decoration-none">{{ $t('lobby.character.form.int') }}</a>
								</div>
								<div class="fw-bold">{{ character.intelligence }}</div>
								<div class="small text-muted">({{ getModifier(character.intelligence) }})</div>
								<div v-if="getSkillsForAbility(character, 'int').length > 0" class="mt-1">
									<a v-for="skill in getSkillsForAbility(character, 'int')" :key="skill.index"
										:href="skillLink(skill.index)"
										class="badge bg-secondary text-decoration-none d-block mb-1 small">
										{{ skill.name }}
									</a>
								</div>
							</div>
						</div>
						<div class="col-4 col-md-2">
							<div class="text-center border rounded p-2">
								<div class="small">
									<a :href="abilityLink('wis')" class="text-muted text-decoration-none">{{ $t('lobby.character.form.wis') }}</a>
								</div>
								<div class="fw-bold">{{ character.wisdom }}</div>
								<div class="small text-muted">({{ getModifier(character.wisdom) }})</div>
								<div v-if="getSkillsForAbility(character, 'wis').length > 0" class="mt-1">
									<a v-for="skill in getSkillsForAbility(character, 'wis')" :key="skill.index"
										:href="skillLink(skill.index)"
										class="badge bg-secondary text-decoration-none d-block mb-1 small">
										{{ skill.name }}
									</a>
								</div>
							</div>
						</div>
						<div class="col-4 col-md-2">
							<div class="text-center border rounded p-2">
								<div class="small">
									<a :href="abilityLink('cha')" class="text-muted text-decoration-none">{{ $t('lobby.character.form.cha') }}</a>
								</div>
								<div class="fw-bold">{{ character.charisma }}</div>
								<div class="small text-muted">({{ getModifier(character.charisma) }})</div>
								<div v-if="getSkillsForAbility(character, 'cha').length > 0" class="mt-1">
									<a v-for="skill in getSkillsForAbility(character, 'cha')" :key="skill.index"
										:href="skillLink(skill.index)"
										class="badge bg-secondary text-decoration-none d-block mb-1 small">
										{{ skill.name }}
									</a>
								</div>
							</div>
						</div>
					</div>

					<div class="d-flex gap-3 text-muted small">
						<span><strong>HP:</strong> {{ character.currentHitPoints }}/{{ character.maxHitPoints }}</span>
						<span><strong>AC:</strong> {{ character.armorClass }}</span>
						<span><strong>{{ $t('lobby.character.form.proficiency') }}:</strong> +{{ character.proficiencyBonus }}</span>
					</div>

					<div v-if="character.background" class="mt-2 small">
						<strong>{{ $t('lobby.character.form.background') }}:</strong> {{ character.background }}
					</div>
					<div v-if="character.notes" class="mt-2 small text-muted fst-italic">
						{{ character.notes }}
					</div>

					<!-- Equipment -->
					<div v-if="character.equipment && character.equipment.length > 0" class="mt-3">
						<strong>{{ $t('lobby.character.form.equipment') }}:</strong>
						<div class="mt-2">
							<div v-for="item in character.equipment" :key="item.id"
								class="d-flex align-items-center justify-content-between py-1 border-bottom">
								<div>
									<a :href="equipmentLink(item.equipmentIndex)" class="text-decoration-none">
										{{ item.equipmentName }}
									</a>
									<span v-if="item.quantity > 1" class="text-muted ms-1">(x{{ item.quantity }})</span>
									<span v-if="getEquipmentDamage(item.equipmentIndex)" class="text-muted ms-2 small">
										{{ getEquipmentDamage(item.equipmentIndex) }}
									</span>
								</div>
								<div v-if="item.currentAmmo !== null && item.currentAmmo !== undefined"
									class="d-flex align-items-center">
									<button v-if="canEditAmmo" class="btn btn-sm btn-outline-secondary py-0 px-1"
										@click="$emit('update-ammo', character, item, -1)">-</button>
									<span class="mx-2 badge"
										:class="ammoClass(item.currentAmmo)">{{ item.currentAmmo }}</span>
									<button v-if="canEditAmmo" class="btn btn-sm btn-outline-secondary py-0 px-1"
										@click="$emit('update-ammo', character, item, 1)">+</button>
								</div>
							</div>
						</div>
					</div>

					<!-- Spells -->
					<div v-if="character.spells && character.spells.length > 0" class="mt-3">
						<strong>{{ $t('lobby.character.form.spells') }}:</strong>

						<!-- Spell Slots -->
						<div v-if="character.spellSlots && character.spellSlots.some(s => s.total > 0)" class="mt-2 mb-3">
							<div class="d-flex flex-wrap gap-2">
								<div v-for="slot in character.spellSlots.filter(s => s.total > 0)" :key="slot.level"
									class="border rounded px-2 py-1 text-center" style="min-width: 60px;">
									<div class="small text-muted">{{ $t('handbook.level') }} {{ slot.level }}</div>
									<div class="d-flex align-items-center justify-content-center">
										<button v-if="canEditSpellSlots" class="btn btn-sm btn-link p-0"
											@click="$emit('use-spell-slot', character, slot.level, 1)"
											:disabled="slot.used >= slot.total">
											<i class="bi bi-dash-circle"></i>
										</button>
										<span class="mx-1" :class="{ 'text-danger': slot.used >= slot.total }">
											{{ slot.total - (slot.used || 0) }}/{{ slot.total }}
										</span>
										<button v-if="canEditSpellSlots" class="btn btn-sm btn-link p-0"
											@click="$emit('use-spell-slot', character, slot.level, -1)"
											:disabled="!slot.used || slot.used <= 0">
											<i class="bi bi-plus-circle"></i>
										</button>
									</div>
								</div>
							</div>
						</div>

						<!-- Spell Lists by Level -->
						<div v-for="level in [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]" :key="level">
							<div v-if="getCharacterSpellsByLevel(level).length > 0" class="mt-2">
								<div class="text-muted small fw-bold">
									{{ level === 0 ? $t('lobby.character.form.cantrips') : $t('handbook.level') + ' ' + level }}
								</div>
								<div class="d-flex flex-wrap gap-1 mt-1">
									<a v-for="spell in getCharacterSpellsByLevel(level)" :key="spell.id"
										:href="spellLink(spell.spellIndex)"
										class="badge text-decoration-none"
										:class="spell.isPrepared || level === 0 ? 'bg-primary' : 'bg-secondary'">
										{{ spell.spellName }}
										<span v-if="level > 0 && !spell.isPrepared" class="ms-1" :title="$t('lobby.character.form.notPrepared')">
											<i class="bi bi-moon"></i>
										</span>
									</a>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	`,
	props: {
		character: {
			type: Object,
			required: true
		},
		skills: {
			type: Array,
			default: () => []
		},
		equipmentList: {
			type: Array,
			default: () => []
		},
		showFullStats: {
			type: Boolean,
			default: false
		},
		showOwner: {
			type: Boolean,
			default: false
		},
		showEditButtons: {
			type: Boolean,
			default: false
		},
		showResetPassword: {
			type: Boolean,
			default: false
		},
		canEditAmmo: {
			type: Boolean,
			default: false
		},
		isHighlighted: {
			type: Boolean,
			default: false
		},
		isOwnerOnline: {
			type: Boolean,
			default: false
		},
		canEditSpellSlots: {
			type: Boolean,
			default: false
		}
	},
	emits: ['edit', 'delete', 'reset-password', 'update-ammo', 'use-spell-slot'],
	setup(props) {
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
			return props.skills.filter(skill => {
				const skillAbility = skill.additionalData?.ability_score?.index ||
					skill.ability_score?.index
				return skillAbility === abilityIndex && char.skills.includes(skill.index)
			})
		}

		function equipmentLink(equipmentIndex) {
			return `/handbook?category=equipment&index=${equipmentIndex}`
		}

		function getEquipmentDamage(equipmentIndex) {
			const item = props.equipmentList.find(e => e.index === equipmentIndex)
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

		function spellLink(spellIndex) {
			return `/handbook?category=spells&index=${spellIndex}`
		}

		function getCharacterSpellsByLevel(level) {
			if (!props.character.spells) return []
			return props.character.spells.filter(s => s.level === level)
		}

		function getAvailableSlots(slotLevel) {
			const slot = props.character.spellSlots?.find(s => s.level === slotLevel)
			if (!slot) return { total: 0, used: 0, available: 0 }
			return {
				total: slot.total,
				used: slot.used || 0,
				available: slot.total - (slot.used || 0)
			}
		}

		return {
			getModifier,
			raceLink,
			classLink,
			abilityLink,
			skillLink,
			getSkillsForAbility,
			equipmentLink,
			getEquipmentDamage,
			ammoClass,
			spellLink,
			getCharacterSpellsByLevel,
			getAvailableSlots
		}
	}
}
