import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

export default {
	name: 'CharacterFormModal',
	template: `
		<div class="modal fade" ref="modalRef" tabindex="-1" aria-hidden="true">
			<div class="modal-dialog modal-lg modal-dialog-scrollable">
				<div class="modal-content">
					<div class="modal-header">
						<h5 class="modal-title">{{ $t('lobby.character.form.title') }}</h5>
						<button type="button" class="btn-close" @click="close" aria-label="Close"></button>
					</div>
					<div class="modal-body">
						<form @submit.prevent="submit">
							<!-- Basic Info -->
							<div class="row g-3 mb-4">
								<div class="col-md-6">
									<label class="form-label">{{ $t('lobby.character.form.name') }} *</label>
									<input type="text" class="form-control" v-model="form.name" required maxlength="100">
								</div>
								<div class="col-md-3">
									<label class="form-label">{{ $t('lobby.character.form.level') }}</label>
									<input type="number" class="form-control" v-model.number="form.level" min="1" max="20">
								</div>
								<div class="col-md-3">
									<label class="form-label">{{ $t('lobby.character.form.proficiency') }}</label>
									<input type="number" class="form-control" v-model.number="form.proficiencyBonus" min="2" max="6" readonly>
								</div>
							</div>

							<!-- Password (only for new characters) -->
							<div v-if="!isEditing" class="row g-3 mb-4">
								<div class="col-md-6">
									<label class="form-label">{{ $t('lobby.character.form.password') }} *</label>
									<input type="password" class="form-control" v-model="form.password" required minlength="4"
										:placeholder="$t('lobby.character.form.passwordPlaceholder')">
									<div class="form-text">{{ $t('lobby.character.form.passwordHelp') }}</div>
								</div>
							</div>

							<!-- Race Selection -->
							<div class="row g-3 mb-4">
								<div class="col-md-6">
									<label class="form-label">{{ $t('lobby.character.form.race') }}</label>
									<select class="form-select" v-model="selectedRace" @change="onRaceChange">
										<option value="">-- {{ $t('lobby.character.form.race') }} --</option>
										<option v-for="race in races" :key="race.index" :value="race.index">
											{{ race.name }}
										</option>
										<option value="__custom__">{{ $t('lobby.character.form.customOption') }}</option>
									</select>
									<input v-if="selectedRace === '__custom__'" type="text" class="form-control mt-2"
										v-model="form.raceName" :placeholder="$t('lobby.character.form.race')" maxlength="50">
								</div>

								<!-- Class Selection -->
								<div class="col-md-6">
									<label class="form-label">{{ $t('lobby.character.form.class') }}</label>
									<select class="form-select" v-model="selectedClass" @change="onClassChange">
										<option value="">-- {{ $t('lobby.character.form.class') }} --</option>
										<option v-for="cls in classes" :key="cls.index" :value="cls.index">
											{{ cls.name }}
										</option>
										<option value="__custom__">{{ $t('lobby.character.form.customOption') }}</option>
									</select>
									<input v-if="selectedClass === '__custom__'" type="text" class="form-control mt-2"
										v-model="form.className" :placeholder="$t('lobby.character.form.class')" maxlength="50">
								</div>
							</div>

							<!-- Hit Points & Armor Class -->
							<div class="row g-3 mb-4">
								<div class="col-md-4">
									<label class="form-label">{{ $t('lobby.character.form.maxHp') }}</label>
									<input type="number" class="form-control" v-model.number="form.maxHitPoints" min="1" max="999">
								</div>
								<div class="col-md-4">
									<label class="form-label">{{ $t('lobby.character.form.currentHp') }}</label>
									<input type="number" class="form-control" v-model.number="form.currentHitPoints" min="0" :max="form.maxHitPoints">
								</div>
								<div class="col-md-4">
									<label class="form-label">{{ $t('lobby.character.form.ac') }}</label>
									<input type="number" class="form-control" v-model.number="form.armorClass" min="1" max="30">
								</div>
							</div>

							<!-- Ability Scores -->
							<h6 class="mb-3">{{ $t('lobby.character.form.coins') }}</h6>
				<div class="row g-3 mb-4">
					<div class="col-6 col-md-2">
						<label class="form-label">{{ $t('lobby.character.form.pp') }}</label>
						<input type="number" class="form-control" v-model.number="form.platinumPieces" min="0" max="999999">
					</div>
					<div class="col-6 col-md-2">
						<label class="form-label">{{ $t('lobby.character.form.gp') }}</label>
						<input type="number" class="form-control" v-model.number="form.goldPieces" min="0" max="999999">
					</div>
					<div class="col-6 col-md-2">
						<label class="form-label">{{ $t('lobby.character.form.ep') }}</label>
						<input type="number" class="form-control" v-model.number="form.electrumPieces" min="0" max="999999">
					</div>
					<div class="col-6 col-md-2">
						<label class="form-label">{{ $t('lobby.character.form.sp') }}</label>
						<input type="number" class="form-control" v-model.number="form.silverPieces" min="0" max="999999">
					</div>
					<div class="col-6 col-md-2">
						<label class="form-label">{{ $t('lobby.character.form.cp') }}</label>
						<input type="number" class="form-control" v-model.number="form.copperPieces" min="0" max="999999">
					</div>
				</div>

				<!-- Ability Scores -->
				<h6 class="mb-3">{{ $t('lobby.character.form.abilities') }}</h6>
							<div class="row g-3 mb-4">
								<div class="col-6 col-sm-4 col-md-2">
									<label class="form-label small">
										<a :href="abilityLink('str')" class="text-decoration-none">{{ $t('lobby.character.form.str') }}</a>
									</label>
									<div class="input-group input-group-sm">
										<button type="button" class="btn btn-outline-secondary" @click="decrement('strength')">-</button>
										<input type="number" class="form-control text-center" v-model.number="form.strength" min="1" max="30">
										<button type="button" class="btn btn-outline-secondary" @click="increment('strength')">+</button>
									</div>
									<div class="text-center small text-muted">{{ getModifier(form.strength) }}</div>
								</div>
								<div class="col-6 col-sm-4 col-md-2">
									<label class="form-label small">
										<a :href="abilityLink('dex')" class="text-decoration-none">{{ $t('lobby.character.form.dex') }}</a>
									</label>
									<div class="input-group input-group-sm">
										<button type="button" class="btn btn-outline-secondary" @click="decrement('dexterity')">-</button>
										<input type="number" class="form-control text-center" v-model.number="form.dexterity" min="1" max="30">
										<button type="button" class="btn btn-outline-secondary" @click="increment('dexterity')">+</button>
									</div>
									<div class="text-center small text-muted">{{ getModifier(form.dexterity) }}</div>
								</div>
								<div class="col-6 col-sm-4 col-md-2">
									<label class="form-label small">
										<a :href="abilityLink('con')" class="text-decoration-none">{{ $t('lobby.character.form.con') }}</a>
									</label>
									<div class="input-group input-group-sm">
										<button type="button" class="btn btn-outline-secondary" @click="decrement('constitution')">-</button>
										<input type="number" class="form-control text-center" v-model.number="form.constitution" min="1" max="30">
										<button type="button" class="btn btn-outline-secondary" @click="increment('constitution')">+</button>
									</div>
									<div class="text-center small text-muted">{{ getModifier(form.constitution) }}</div>
								</div>
								<div class="col-6 col-sm-4 col-md-2">
									<label class="form-label small">
										<a :href="abilityLink('int')" class="text-decoration-none">{{ $t('lobby.character.form.int') }}</a>
									</label>
									<div class="input-group input-group-sm">
										<button type="button" class="btn btn-outline-secondary" @click="decrement('intelligence')">-</button>
										<input type="number" class="form-control text-center" v-model.number="form.intelligence" min="1" max="30">
										<button type="button" class="btn btn-outline-secondary" @click="increment('intelligence')">+</button>
									</div>
									<div class="text-center small text-muted">{{ getModifier(form.intelligence) }}</div>
								</div>
								<div class="col-6 col-sm-4 col-md-2">
									<label class="form-label small">
										<a :href="abilityLink('wis')" class="text-decoration-none">{{ $t('lobby.character.form.wis') }}</a>
									</label>
									<div class="input-group input-group-sm">
										<button type="button" class="btn btn-outline-secondary" @click="decrement('wisdom')">-</button>
										<input type="number" class="form-control text-center" v-model.number="form.wisdom" min="1" max="30">
										<button type="button" class="btn btn-outline-secondary" @click="increment('wisdom')">+</button>
									</div>
									<div class="text-center small text-muted">{{ getModifier(form.wisdom) }}</div>
								</div>
								<div class="col-6 col-sm-4 col-md-2">
									<label class="form-label small">
										<a :href="abilityLink('cha')" class="text-decoration-none">{{ $t('lobby.character.form.cha') }}</a>
									</label>
									<div class="input-group input-group-sm">
										<button type="button" class="btn btn-outline-secondary" @click="decrement('charisma')">-</button>
										<input type="number" class="form-control text-center" v-model.number="form.charisma" min="1" max="30">
										<button type="button" class="btn btn-outline-secondary" @click="increment('charisma')">+</button>
									</div>
									<div class="text-center small text-muted">{{ getModifier(form.charisma) }}</div>
								</div>
							</div>

							<!-- Skills Selection -->
							<h6 class="mb-3">{{ $t('lobby.character.form.skills') }}</h6>
							<div class="row g-2 mb-4">
								<div v-for="(group, abilityKey) in skillsGroupedByAbility" :key="abilityKey" class="col-12 col-sm-6 col-lg-4">
									<div class="card h-100">
										<div class="card-header py-2">
											<a :href="abilityLink(abilityKey)" class="text-decoration-none fw-bold small">
												{{ group.label }}
											</a>
										</div>
										<div class="card-body py-2">
											<div v-if="group.skills.length === 0" class="text-muted small">
												{{ $t('lobby.character.form.noSkills') }}
											</div>
											<div v-for="skill in group.skills" :key="skill.index" class="form-check">
												<input class="form-check-input" type="checkbox"
													:id="'skill-' + skill.index"
													:value="skill.index"
													v-model="form.skills">
												<label class="form-check-label small" :for="'skill-' + skill.index">
													<a :href="skillLink(skill.index)" class="text-decoration-none">
														{{ skill.name }}
													</a>
												</label>
											</div>
										</div>
									</div>
								</div>
							</div>

							<!-- Equipment Selection -->
							<h6 class="mb-3">{{ $t('lobby.character.form.equipment') }}</h6>

							<!-- Mode Toggle -->
							<div class="btn-group mb-3" role="group">
								<button type="button" class="btn btn-sm"
									:class="equipmentMode === 'handbook' ? 'btn-primary' : 'btn-outline-secondary'"
									@click="equipmentMode = 'handbook'">
									{{ $t('lobby.character.form.handbookEquipment') }}
								</button>
								<button type="button" class="btn btn-sm"
									:class="equipmentMode === 'custom' ? 'btn-primary' : 'btn-outline-secondary'"
									@click="equipmentMode = 'custom'">
									{{ $t('lobby.character.form.customEquipment') }}
								</button>
							</div>

							<!-- Handbook Equipment Selection -->
							<div v-if="equipmentMode === 'handbook'" class="row g-2 mb-4">
								<div class="col-12 col-md-8">
									<input type="text" class="form-control mb-2" v-model="equipmentSearch"
										:placeholder="$t('lobby.character.form.searchPlaceholder')">
									<select class="form-select" v-model="selectedEquipment" @change="addEquipment" size="6">
										<option value="">-- {{ $t('lobby.character.form.selectEquipment') }} --</option>
										<optgroup v-for="(cat, catKey) in equipmentByCategory" :key="catKey" :label="cat.name">
											<option v-for="item in cat.items" :key="item.index" :value="item.index">
												{{ item.name }}
											</option>
										</optgroup>
									</select>
								</div>
							</div>

							<!-- Custom Equipment Form -->
							<div v-if="equipmentMode === 'custom'" class="row g-3 mb-4">
								<div class="col-md-6">
									<label class="form-label">{{ $t('lobby.character.form.equipmentName') }} *</label>
									<input type="text" class="form-control" v-model="customEquipmentForm.name" maxlength="100">
								</div>
								<div class="col-md-6">
									<label class="form-label">{{ $t('lobby.character.form.damage') }}</label>
									<input type="text" class="form-control" v-model="customEquipmentForm.damage"
										placeholder="1d8 slashing" maxlength="50">
								</div>
								<div class="col-md-6">
									<label class="form-label">{{ $t('lobby.character.form.cost') }}</label>
									<input type="text" class="form-control" v-model="customEquipmentForm.cost"
										placeholder="15 gp" maxlength="50">
								</div>
								<div class="col-md-12">
									<label class="form-label">{{ $t('lobby.character.form.description') }}</label>
									<textarea class="form-control" v-model="customEquipmentForm.description"
										rows="2" maxlength="500"></textarea>
								</div>
								<div class="col-12">
									<button type="button" class="btn btn-sm btn-primary" @click="addCustomEquipment"
										:disabled="!customEquipmentForm.name.trim()">
										{{ $t('lobby.character.form.addCustomEquipment') }}
									</button>
								</div>
							</div>

							<!-- Equipment List -->
							<div v-if="form.equipment.length > 0" class="mb-4">
								<div v-for="(item, idx) in form.equipment" :key="item.id"
									class="d-flex align-items-center border rounded p-2 mb-2">
									<div class="flex-grow-1">
										<!-- Handbook equipment: show link -->
										<a v-if="item.equipmentIndex" :href="equipmentLink(item.equipmentIndex)"
											class="text-decoration-none fw-bold">
											{{ item.equipmentName }}
										</a>
										<!-- Custom equipment: just show name -->
										<span v-else class="fw-bold">{{ item.equipmentName }}</span>
										<span v-if="!item.equipmentIndex" class="badge bg-secondary ms-2 small">Custom</span>

										<!-- Show damage (handbook or custom) -->
										<span v-if="item.equipmentIndex && getEquipmentDamage(item.equipmentIndex)"
											class="text-muted ms-2 small">
											({{ getEquipmentDamage(item.equipmentIndex) }})
										</span>
										<span v-else-if="item.customDamage" class="text-muted ms-2 small">
											({{ item.customDamage }})
										</span>

										<!-- Show custom cost if present -->
										<span v-if="item.customCost" class="text-muted ms-2 small">
											- {{ item.customCost }}
										</span>

										<!-- Show custom description as tooltip -->
										<i v-if="item.customDescription" class="bi bi-info-circle ms-1"
											:title="item.customDescription"></i>
									</div>
									<div v-if="isAmmunitionWeapon(item.equipmentIndex)" class="me-3 d-flex align-items-center">
										<label class="form-label small mb-0 me-2">{{ $t('lobby.character.form.ammo') }}:</label>
										<input type="number" class="form-control form-control-sm"
											v-model.number="item.currentAmmo" min="0" max="999" style="width: 70px;">
									</div>
									<button type="button" class="btn btn-sm btn-outline-danger" @click="removeEquipment(idx)">
										<i class="bi bi-trash"></i>
									</button>
								</div>
							</div>

							<!-- Spell Slots -->
							<div v-if="form.spells.some(s => s.level > 0)" class="mb-4">
								<h6 class="mb-3">{{ $t('lobby.character.form.spellSlots') }}</h6>
								<div class="row g-2">
									<div v-for="slot in form.spellSlots.filter(s => s.total > 0 || s.level <= 5)"
										:key="slot.level" class="col-4 col-md-2">
										<div class="text-center border rounded p-2">
											<div class="small text-muted">{{ $t('handbook.level') }} {{ slot.level }}</div>
											<input type="number" class="form-control form-control-sm text-center"
												v-model.number="slot.total" min="0" max="9">
										</div>
									</div>
								</div>
							</div>

							<!-- Spells Selection -->
							<h6 class="mb-3">{{ $t('lobby.character.form.spells') }}</h6>

							<!-- Mode Toggle -->
							<div class="btn-group mb-3" role="group">
								<button type="button" class="btn btn-sm"
									:class="spellMode === 'handbook' ? 'btn-primary' : 'btn-outline-secondary'"
									@click="spellMode = 'handbook'">
									{{ $t('lobby.character.form.handbookSpells') }}
								</button>
								<button type="button" class="btn btn-sm"
									:class="spellMode === 'custom' ? 'btn-primary' : 'btn-outline-secondary'"
									@click="spellMode = 'custom'">
									{{ $t('lobby.character.form.customSpells') }}
								</button>
							</div>

							<!-- Handbook Spell Selection -->
							<div v-if="spellMode === 'handbook'" class="row g-2 mb-4">
								<div class="col-12 col-md-8">
									<input type="text" class="form-control mb-2" v-model="spellSearch"
										:placeholder="$t('lobby.character.form.searchPlaceholder')">
									<select class="form-select" v-model="selectedSpell" @change="addSpell" size="6">
										<option value="">-- {{ $t('lobby.character.form.selectSpell') }} --</option>
										<optgroup v-for="(levelGroup, levelKey) in spellsByLevel" :key="levelKey" :label="levelGroup.label">
											<option v-for="spell in levelGroup.spells" :key="spell.index" :value="spell.index"
												:disabled="form.spells.some(s => s.spellIndex === spell.index)">
												{{ spell.name }}
											</option>
										</optgroup>
									</select>
								</div>
							</div>

							<!-- Custom Spell Form -->
							<div v-if="spellMode === 'custom'" class="row g-3 mb-4">
								<div class="col-md-6">
									<label class="form-label">{{ $t('lobby.character.form.spellName') }} *</label>
									<input type="text" class="form-control" v-model="customSpellForm.name" maxlength="100">
								</div>
								<div class="col-md-3">
									<label class="form-label">{{ $t('lobby.character.form.spellLevel') }}</label>
									<select class="form-select" v-model.number="customSpellForm.level">
										<option :value="0">{{ $t('lobby.character.form.cantrips') }}</option>
										<option v-for="lvl in [1,2,3,4,5,6,7,8,9]" :key="lvl" :value="lvl">
											{{ $t('handbook.level') }} {{ lvl }}
										</option>
									</select>
								</div>
								<div class="col-md-3">
									<label class="form-label">{{ $t('lobby.character.form.damage') }}</label>
									<input type="text" class="form-control" v-model="customSpellForm.damage"
										placeholder="8d6" maxlength="50">
								</div>
								<div class="col-md-6">
									<label class="form-label">{{ $t('lobby.character.form.damageType') }}</label>
									<input type="text" class="form-control" v-model="customSpellForm.damageType"
										placeholder="fire" maxlength="50">
								</div>
								<div class="col-md-12">
									<label class="form-label">{{ $t('lobby.character.form.description') }}</label>
									<textarea class="form-control" v-model="customSpellForm.description"
										rows="2" maxlength="500"></textarea>
								</div>
								<div class="col-12">
									<button type="button" class="btn btn-sm btn-primary" @click="addCustomSpell"
										:disabled="!customSpellForm.name.trim()">
										{{ $t('lobby.character.form.addCustomSpell') }}
									</button>
								</div>
							</div>

							<!-- Spells List grouped by level -->
							<div v-if="form.spells.length > 0" class="mb-4">
								<div v-for="level in [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]" :key="level">
									<div v-if="getCharacterSpellsByLevel(level).length > 0" class="mb-3">
										<h6 class="text-muted small">
											{{ level === 0 ? $t('lobby.character.form.cantrips') : $t('handbook.level') + ' ' + level }}
										</h6>
										<div v-for="spell in getCharacterSpellsByLevel(level)" :key="spell.id"
											class="d-flex align-items-center border rounded p-2 mb-2">
											<div v-if="level > 0" class="me-2">
												<input type="checkbox" class="form-check-input"
													:checked="spell.isPrepared"
													@change="toggleSpellPrepared(spell)"
													:title="$t('lobby.character.form.prepared')">
											</div>
											<div class="flex-grow-1">
												<!-- Handbook spell with link -->
												<a v-if="spell.spellIndex" :href="spellLink(spell.spellIndex)"
													class="text-decoration-none fw-bold">
													{{ spell.spellName }}
												</a>
												<!-- Custom spell -->
												<span v-else class="fw-bold">{{ spell.spellName }}</span>
												<span v-if="!spell.spellIndex" class="badge bg-secondary ms-2 small">Custom</span>

												<!-- Show custom damage -->
												<span v-if="spell.customDamage" class="text-muted ms-2 small">
													({{ spell.customDamage }}
													<span v-if="spell.customDamageType">{{ spell.customDamageType }}</span>)
												</span>

												<!-- Show custom description as tooltip -->
												<i v-if="spell.customDescription" class="bi bi-info-circle ms-1"
													:title="spell.customDescription"></i>
											</div>
											<button type="button" class="btn btn-sm btn-outline-danger"
												@click="removeSpell(form.spells.indexOf(spell))">
												<i class="bi bi-trash"></i>
											</button>
										</div>
									</div>
								</div>
							</div>

							<!-- Features Selection -->
							<h6 class="mb-3">{{ $t('lobby.character.form.features') }}</h6>
							<div class="row g-2 mb-4">
								<div class="col-12 col-md-8">
									<input type="text" class="form-control mb-2" v-model="featureSearch"
										:placeholder="$t('lobby.character.form.searchPlaceholder')">
									<select class="form-select" v-model="selectedFeature" @change="addFeature" size="6">
										<option value="">-- {{ $t('lobby.character.form.selectFeature') }} --</option>
										<optgroup v-for="(levelGroup, levelKey) in featuresByLevel" :key="levelKey" :label="levelGroup.label">
											<option v-for="feature in levelGroup.features" :key="feature.index" :value="feature.index"
												:disabled="form.features.some(f => f.featureIndex === feature.index)">
												{{ feature.name }}
											</option>
										</optgroup>
									</select>
								</div>
							</div>

							<!-- Features List grouped by level -->
							<div v-if="form.features.length > 0" class="mb-4">
								<div v-for="level in [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]" :key="level">
									<div v-if="getCharacterFeaturesByLevel(level).length > 0" class="mb-3">
										<h6 class="text-muted small">{{ $t('handbook.level') + ' ' + level }}</h6>
										<div v-for="feature in getCharacterFeaturesByLevel(level)" :key="feature.id"
											class="d-flex align-items-center border rounded p-2 mb-2">
											<div class="flex-grow-1">
												<a :href="featureLink(feature.featureIndex)" class="text-decoration-none fw-bold">
													{{ feature.featureName }}
												</a>
											</div>
											<button type="button" class="btn btn-sm btn-outline-danger"
												@click="removeFeature(form.features.indexOf(feature))">
												<i class="bi bi-trash"></i>
											</button>
										</div>
									</div>
								</div>
							</div>

							<!-- Traits Selection -->
							<h6 class="mb-3">{{ $t('lobby.character.form.traits') }}</h6>
							<div class="row g-2 mb-4">
								<div class="col-12 col-md-8">
									<input type="text" class="form-control mb-2" v-model="traitSearch"
										:placeholder="$t('lobby.character.form.searchPlaceholder')">
									<select class="form-select" v-model="selectedTrait" @change="addTrait" size="6">
										<option value="">-- {{ $t('lobby.character.form.selectTrait') }} --</option>
										<option v-for="trait in traitsByRace" :key="trait.index" :value="trait.index"
											:disabled="form.traits.some(t => t.traitIndex === trait.index)">
											{{ trait.name }}
										</option>
									</select>
								</div>
							</div>

							<!-- Traits List -->
							<div v-if="form.traits.length > 0" class="mb-4">
								<div v-for="trait in form.traits" :key="trait.id"
									class="d-flex align-items-center border rounded p-2 mb-2">
									<div class="flex-grow-1">
										<a :href="traitLink(trait.traitIndex)" class="text-decoration-none fw-bold">
											{{ trait.traitName }}
										</a>
									</div>
									<button type="button" class="btn btn-sm btn-outline-danger"
										@click="removeTrait(form.traits.indexOf(trait))">
										<i class="bi bi-trash"></i>
									</button>
								</div>
							</div>

							<!-- Languages Selection -->
							<h6 class="mb-3">{{ $t('lobby.character.form.languages') }}</h6>
							<div class="row g-2 mb-4">
								<div class="col-12 col-md-8">
									<input type="text" class="form-control mb-2" v-model="languageSearch"
										:placeholder="$t('lobby.character.form.searchPlaceholder')">
									<select class="form-select" v-model="selectedLanguage" @change="addLanguage" size="6">
										<option value="">-- {{ $t('lobby.character.form.selectLanguage') }} --</option>
										<optgroup v-for="(typeGroup, typeKey) in languagesByType" :key="typeKey" :label="typeGroup.label">
											<option v-for="language in typeGroup.languages" :key="language.index" :value="language.index"
												:disabled="form.languages.some(l => l.languageIndex === language.index)">
												{{ language.name }}
											</option>
										</optgroup>
									</select>
								</div>
							</div>

							<!-- Languages List -->
							<div v-if="form.languages.length > 0" class="mb-4">
								<div v-for="language in form.languages" :key="language.id"
									class="d-flex align-items-center border rounded p-2 mb-2">
									<div class="flex-grow-1">
										<a :href="languageLink(language.languageIndex)" class="text-decoration-none fw-bold">
											{{ language.languageName }}
										</a>
									</div>
									<button type="button" class="btn btn-sm btn-outline-danger"
										@click="removeLanguage(form.languages.indexOf(language))">
										<i class="bi bi-trash"></i>
									</button>
								</div>
							</div>

						<!-- Custom Properties Section -->
						<h6 class="mb-3">{{ $t('lobby.character.form.customProperties') }}</h6>
						<div class="row g-3 mb-4">
							<div class="col-md-12">
								<label class="form-label">{{ $t('lobby.character.form.customPropertyName') }}</label>
								<input type="text" class="form-control" v-model="customPropertyForm.name"
									:placeholder="$t('lobby.character.form.customPropertyNamePlaceholder')" maxlength="100">
							</div>
							<div class="col-md-12">
								<label class="form-label">{{ $t('lobby.character.form.customPropertyDescription') }}</label>
								<textarea class="form-control" v-model="customPropertyForm.description"
									:placeholder="$t('lobby.character.form.customPropertyDescriptionPlaceholder')"
									rows="3" maxlength="5000"></textarea>
							</div>
							<div class="col-12">
								<button type="button" class="btn btn-sm btn-primary" @click="addCustomProperty"
									:disabled="!customPropertyForm.name.trim()">
									{{ $t('lobby.character.form.addCustomProperty') }}
								</button>
							</div>
						</div>

						<!-- Custom Properties List -->
						<div v-if="form.customProperties.length > 0" class="mb-4">
							<div v-for="(property, idx) in form.customProperties" :key="property.id"
								class="border rounded p-3 mb-2">
								<div class="d-flex justify-content-between align-items-start">
									<div class="flex-grow-1">
										<div class="fw-bold">{{ property.name }}</div>
										<div class="text-muted small mt-1" v-if="property.description">
											{{ property.description }}
										</div>
									</div>
									<button type="button" class="btn btn-sm btn-outline-danger ms-2"
										@click="removeCustomProperty(idx)">
										<i class="bi bi-trash"></i>
									</button>
								</div>
							</div>
						</div>

							<!-- Background & Notes -->
							<div class="row g-3">
								<div class="col-md-6">
									<label class="form-label">{{ $t('lobby.character.form.background') }}</label>
									<input type="text" class="form-control" v-model="form.background" maxlength="100">
								</div>
								<div class="col-md-6">
									<label class="form-label">{{ $t('lobby.character.form.notes') }}</label>
									<textarea class="form-control" v-model="form.notes" rows="2" maxlength="500"></textarea>
								</div>
							</div>
						</form>
					</div>
					<div class="modal-footer">
						<button type="button" class="btn btn-secondary" @click="close">
							{{ $t('lobby.character.form.cancel') }}
						</button>
						<button type="button" class="btn btn-primary" @click="submit" :disabled="!isValid || isSaving">
							<span v-if="isSaving" class="spinner-border spinner-border-sm me-1"></span>
							{{ $t('lobby.character.form.save') }}
						</button>
					</div>
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
		},
		races: {
			type: Array,
			default: () => []
		},
		classes: {
			type: Array,
			default: () => []
		},
		skills: {
			type: Array,
			default: () => []
		},
		equipmentList: {
			type: Array,
			default: () => []
		},
		spellsList: {
			type: Array,
			default: () => []
		},
		featuresList: {
			type: Array,
			default: () => []
		},
		traitsList: {
			type: Array,
			default: () => []
		},
		languagesList: {
			type: Array,
			default: () => []
		}
	},
	emits: ['character-saved'],
	setup(props, { emit }) {
		const { t } = useI18n()

		function generateUUID() {
			if (typeof crypto !== 'undefined' && crypto.randomUUID) {
				return crypto.randomUUID();
			}
			// Fallback for older browsers or non-secure contexts
			return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
				const r = Math.random() * 16 | 0
				const v = c === 'x' ? r : (r & 0x3 | 0x8)
				return v.toString(16)
			})
		}

		const modalRef = ref(null)
		const modalInstance = ref(null)
		const isEditing = ref(false)
		const editingCharacterId = ref(null)
		const isSaving = ref(false)

		const selectedRace = ref('')
		const selectedClass = ref('')

		const skillsGroupedByAbility = computed(() => {
			const groups = {
				str: { label: t('lobby.character.form.str'), skills: [] },
				dex: { label: t('lobby.character.form.dex'), skills: [] },
				con: { label: t('lobby.character.form.con'), skills: [] },
				int: { label: t('lobby.character.form.int'), skills: [] },
				wis: { label: t('lobby.character.form.wis'), skills: [] },
				cha: { label: t('lobby.character.form.cha'), skills: [] }
			}
			props.skills.forEach(skill => {
				const abilityIndex = skill.ability_score?.index
				if (abilityIndex && groups[abilityIndex]) {
					groups[abilityIndex].skills.push(skill)
				}
			})
			return groups
		})

		const equipmentByCategory = computed(() => {
			const categories = {}

			// Filter by search term
			const searchTerm = equipmentSearch.value.toLowerCase().trim()
			const filteredList = searchTerm
				? props.equipmentList.filter(item => item.name.toLowerCase().includes(searchTerm))
				: props.equipmentList

			filteredList.forEach(item => {
				const catIndex = item.equipment_category?.index || item.additionalData?.equipment_category?.index || 'other'
				const catName = item.equipment_category?.name || item.additionalData?.equipment_category?.name || 'Other'
				if (!categories[catIndex]) {
					categories[catIndex] = { name: catName, items: [] }
				}
				categories[catIndex].items.push(item)
			})

			// Sort items alphabetically within each category
			Object.values(categories).forEach(cat => {
				cat.items.sort((a, b) => a.name.localeCompare(b.name))
			})

			return categories
		})

		function isAmmunitionWeapon(equipmentIndex) {
			const item = props.equipmentList.find(e => e.index === equipmentIndex)
			if (!item) return false
			const props_arr = item.properties || item.additionalData?.properties
			if (!props_arr) return false
			return props_arr.some(p => p.index === 'ammunition')
		}

		function getEquipmentDamage(equipmentIndex) {
			const item = props.equipmentList.find(e => e.index === equipmentIndex)
			if (!item) return null
			const damage = item.damage || item.additionalData?.damage
			if (!damage) return null
			const dice = damage.damage_dice
			const typeName = damage.damage_type?.name
			return typeName ? `${dice} ${typeName.toLowerCase()}` : dice
		}

		function addEquipment() {
			if (!selectedEquipment.value) return
			const item = props.equipmentList.find(e => e.index === selectedEquipment.value)
			if (!item) return

			const isAmmo = isAmmunitionWeapon(item.index)

			form.value.equipment.push({
				id: generateUUID(),
				equipmentIndex: item.index,
				equipmentName: item.name,
				quantity: 1,
				currentAmmo: isAmmo ? 20 : null,
				isEquipped: true
			})

			selectedEquipment.value = ''
		}

		function addCustomEquipment() {
			if (!customEquipmentForm.value.name.trim()) return

			form.value.equipment.push({
				id: generateUUID(),
				equipmentIndex: '', // Empty = custom
				equipmentName: customEquipmentForm.value.name.trim(),
				quantity: 1,
				currentAmmo: null,
				isEquipped: true,
				customDamage: customEquipmentForm.value.damage.trim() || null,
				customDescription: customEquipmentForm.value.description.trim() || null,
				customCost: customEquipmentForm.value.cost.trim() || null
			})

			// Reset form
			customEquipmentForm.value = { name: '', damage: '', description: '', cost: '' }
		}

		function removeEquipment(index) {
			form.value.equipment.splice(index, 1)
		}

		function equipmentLink(equipmentIndex) {
			return `/handbook?category=equipment&index=${equipmentIndex}`
		}

		function addSpell() {
			if (!selectedSpell.value) return
			const spell = props.spellsList.find(s => s.index === selectedSpell.value)
			if (!spell) return

			// Check if already added
			if (form.value.spells.some(s => s.spellIndex === spell.index)) {
				selectedSpell.value = ''
				return
			}

			form.value.spells.push({
				id: generateUUID(),
				spellIndex: spell.index,
				spellName: spell.name,
				level: spell.level,
				isPrepared: spell.level === 0 // Cantrips always prepared
			})

			selectedSpell.value = ''
		}

		function addCustomSpell() {
			if (!customSpellForm.value.name.trim()) return

			form.value.spells.push({
				id: generateUUID(),
				spellIndex: '', // Empty = custom
				spellName: customSpellForm.value.name.trim(),
				level: customSpellForm.value.level,
				isPrepared: customSpellForm.value.level === 0, // Cantrips auto-prepared
				customDamage: customSpellForm.value.damage.trim() || null,
				customDamageType: customSpellForm.value.damageType.trim() || null,
				customDescription: customSpellForm.value.description.trim() || null
			})

			// Reset form
			customSpellForm.value = { name: '', level: 0, damage: '', damageType: '', description: '' }
		}

		function removeSpell(index) {
			form.value.spells.splice(index, 1)
		}

		function toggleSpellPrepared(spell) {
			if (spell.level === 0) return // Cantrips are always prepared
			spell.isPrepared = !spell.isPrepared
		}

		function spellLink(spellIndex) {
			return `/handbook?category=spells&index=${spellIndex}`
		}

		function getCharacterSpellsByLevel(level) {
			return form.value.spells.filter(s => s.level === level)
		}

		function addFeature() {
			if (!selectedFeature.value) return
			const feature = props.featuresList.find(f => f.index === selectedFeature.value)
			if (!feature) return
			if (form.value.features.some(f => f.featureIndex === feature.index)) {
				selectedFeature.value = ''
				return
			}
			form.value.features.push({
				id: generateUUID(),
				featureIndex: feature.index,
				featureName: feature.name,
				level: feature.level
			})
			selectedFeature.value = ''
		}

		function removeFeature(index) {
			form.value.features.splice(index, 1)
		}

		function addLanguage() {
			if (!selectedLanguage.value) return
			const language = props.languagesList.find(t => t.index === selectedLanguage.value)
			if (!language) return
			if (form.value.languages.some(t => t.languageIndex === language.index)) {
				selectedLanguage.value = ''
				return
			}
			form.value.languages.push({
				id: generateUUID(),
				languageIndex: language.index,
				languageName: language.name
			})
			selectedLanguage.value = ''
		}
		function removeLanguage() {
			form.value.languages.splice(index, 1)
		}

		function languageLink(languageIndex) {
			return `/handbook?category=languages&index=${languageIndex}`
		}

	function addCustomProperty() {
		if (!customPropertyForm.value.name.trim()) return

		form.value.customProperties.push({
			id: generateUUID(),
			name: customPropertyForm.value.name.trim(),
			description: customPropertyForm.value.description.trim() || ''
		})

		// Reset form
		customPropertyForm.value = { name: '', description: '' }
	}

	function removeCustomProperty(index) {
		form.value.customProperties.splice(index, 1)
	}

		function addTrait() {
			if (!selectedTrait.value) return
			const trait = props.traitsList.find(t => t.index === selectedTrait.value)
			if (!trait) return
			if (form.value.traits.some(t => t.traitIndex === trait.index)) {
				selectedTrait.value = ''
				return
			}
			form.value.traits.push({
				id: generateUUID(),
				traitIndex: trait.index,
				traitName: trait.name
			})
			selectedTrait.value = ''
		}

		function removeTrait(index) {
			form.value.traits.splice(index, 1)
		}

		function getCharacterFeaturesByLevel(level) {
			return form.value.features.filter(f => f.level === level)
		}

		function featureLink(featureIndex) {
			return `/handbook?category=features&index=${featureIndex}`
		}

		function traitLink(traitIndex) {
			return `/handbook?category=traits&index=${traitIndex}`
		}

		const selectedEquipment = ref('')
		const selectedSpell = ref('')
		const selectedFeature = ref('')
		const selectedTrait = ref('')
		const selectedLanguage = ref('')
		const spellSearch = ref('')
		const equipmentSearch = ref('')
		const featureSearch = ref('')
		const traitSearch = ref('')
		const languageSearch = ref('')
		const equipmentMode = ref('handbook')
		const customEquipmentForm = ref({
			name: '',
			damage: '',
			description: '',
			cost: ''
		})
		const spellMode = ref('handbook')
		const customSpellForm = ref({
			name: '',
			level: 0,
			damage: '',
			damageType: '',
			description: ''
		})
		const customPropertyForm = ref({
			name: '',
			description: ''
		})

		const spellsByLevel = computed(() => {
			const levels = {}
			// Get spells for character's class, or all spells if no class selected
			let availableSpells = selectedClass.value && selectedClass.value !== '__custom__'
				? props.spellsList.filter(s => s.classes?.some(c => c.index === selectedClass.value))
				: props.spellsList

			// Filter by search term
			const searchTerm = spellSearch.value.toLowerCase().trim()
			if (searchTerm) {
				availableSpells = availableSpells.filter(s =>
					s.name.toLowerCase().includes(searchTerm)
				)
			}

			availableSpells.forEach(spell => {
				const level = spell.level
				if (!levels[level]) {
					levels[level] = {
						label: level === 0 ? t('lobby.character.form.cantrips') : `${t('handbook.level')} ${level}`,
						spells: []
					}
				}
				levels[level].spells.push(spell)
			})

			// Sort spells alphabetically within each level
			Object.values(levels).forEach(group => {
				group.spells.sort((a, b) => a.name.localeCompare(b.name))
			})

			return levels
		})

		const featuresByLevel = computed(() => {
			const levels = {}
			let availableFeatures = selectedClass.value && selectedClass.value !== '__custom__'
				? props.featuresList.filter(f => f.class?.index === selectedClass.value)
				: props.featuresList

			const searchTerm = featureSearch.value.toLowerCase().trim()
			if (searchTerm) {
				availableFeatures = availableFeatures.filter(f =>
					f.name.toLowerCase().includes(searchTerm))
			}

			availableFeatures.forEach(feature => {
				const level = feature.level
				if (!levels[level]) {
					levels[level] = { label: `${t('handbook.level')} ${level}`, features: [] }
				}
				levels[level].features.push(feature)
			})

			Object.values(levels).forEach(group => {
				group.features.sort((a, b) => a.name.localeCompare(b.name))
			})

			return levels
		})

		const traitsByRace = computed(() => {
			let availableTraits = selectedRace.value && selectedRace.value !== '__custom__'
				? props.traitsList.filter(t => t.races?.some(r => r.index === selectedRace.value))
				: props.traitsList

			const searchTerm = traitSearch.value.toLowerCase().trim()
			if (searchTerm) {
				availableTraits = availableTraits.filter(t =>
					t.name.toLowerCase().includes(searchTerm))
			}

			return availableTraits.sort((a, b) => a.name.localeCompare(b.name))
		})


	const languagesByType = computed(() => {
		let availableLanguages = props.languagesList

		const searchTerm = languageSearch.value.toLowerCase().trim()
		if (searchTerm) {
			availableLanguages = availableLanguages.filter(l =>
				l.name.toLowerCase().includes(searchTerm))
		}

		// Collect all unique types from the languages list
		const types = {}
		availableLanguages.forEach(language => {
			const type = language.type || 'Standard'
			if (!types[type]) {
				types[type] = { label: type, languages: [] }
			}
			types[type].languages.push(language)
		})

		// Sort languages alphabetically within each type
		Object.values(types).forEach(group => {
			group.languages.sort((a, b) => a.name.localeCompare(b.name))
		})

		return types
	})
		const defaultForm = () => ({
			name: '',
			password: '',
			raceIndex: null,
			classIndex: null,
			raceName: '',
			className: '',
			level: 1,
			maxHitPoints: 10,
			currentHitPoints: 10,
			armorClass: 10,
			proficiencyBonus: 2,
			copperPieces: 0,
			silverPieces: 0,
			electrumPieces: 0,
			goldPieces: 0,
			platinumPieces: 0,
			strength: 10,
			dexterity: 10,
			constitution: 10,
			intelligence: 10,
			wisdom: 10,
			charisma: 10,
			background: '',
			notes: '',
			skills: [],
			equipment: [],
			spells: [],
			features: [],
			traits: [],
			languages: [],
			customProperties: [],
			spellSlots: [
				{ level: 1, total: 0, used: 0 },
				{ level: 2, total: 0, used: 0 },
				{ level: 3, total: 0, used: 0 },
				{ level: 4, total: 0, used: 0 },
				{ level: 5, total: 0, used: 0 },
				{ level: 6, total: 0, used: 0 },
				{ level: 7, total: 0, used: 0 },
				{ level: 8, total: 0, used: 0 },
				{ level: 9, total: 0, used: 0 }
			]
		})

		const form = ref(defaultForm())

		const isValid = computed(() => {
			const nameValid = form.value.name.trim().length > 0
			const passwordValid = isEditing.value || form.value.password.length >= 4
			return nameValid && passwordValid
		})

		// Calculate proficiency bonus based on level
		watch(() => form.value.level, (newLevel) => {
			if (newLevel >= 1 && newLevel <= 4) form.value.proficiencyBonus = 2
			else if (newLevel >= 5 && newLevel <= 8) form.value.proficiencyBonus = 3
			else if (newLevel >= 9 && newLevel <= 12) form.value.proficiencyBonus = 4
			else if (newLevel >= 13 && newLevel <= 16) form.value.proficiencyBonus = 5
			else if (newLevel >= 17) form.value.proficiencyBonus = 6
		})

		function getModifier(score) {
			const mod = Math.floor((score - 10) / 2)
			return mod >= 0 ? `+${mod}` : `${mod}`
		}

		function increment(stat) {
			if (form.value[stat] < 30) {
				form.value[stat]++
			}
		}

		function decrement(stat) {
			if (form.value[stat] > 1) {
				form.value[stat]--
			}
		}

		function abilityLink(abilityIndex) {
			return `/handbook?category=abilityScores&index=${abilityIndex}`
		}

		function skillLink(skillIndex) {
			return `/handbook?category=skills&index=${skillIndex}`
		}

		function onRaceChange() {
			if (selectedRace.value === '__custom__') {
				form.value.raceIndex = null
				form.value.raceName = ''
			} else if (selectedRace.value) {
				const race = props.races.find(r => r.index === selectedRace.value)
				form.value.raceIndex = selectedRace.value
				form.value.raceName = race ? race.name : selectedRace.value
			} else {
				form.value.raceIndex = null
				form.value.raceName = ''
			}
		}

		function onClassChange() {
			if (selectedClass.value === '__custom__') {
				form.value.classIndex = null
				form.value.className = ''
			} else if (selectedClass.value) {
				const cls = props.classes.find(c => c.index === selectedClass.value)
				form.value.classIndex = selectedClass.value
				form.value.className = cls ? cls.name : selectedClass.value
			} else {
				form.value.classIndex = null
				form.value.className = ''
			}
		}

		function openForCreate() {
			isEditing.value = false
			editingCharacterId.value = null
			form.value = defaultForm()
			selectedRace.value = ''
			selectedClass.value = ''
			selectedEquipment.value = ''
			selectedSpell.value = ''
			showModal()
		}

		function openForEdit(character) {
			isEditing.value = true
			editingCharacterId.value = character.id

			form.value = {
				name: character.name || '',
				raceIndex: character.raceIndex,
				classIndex: character.classIndex,
				raceName: character.raceName || '',
				className: character.className || '',
				level: character.level || 1,
				maxHitPoints: character.maxHitPoints || 10,
				currentHitPoints: character.currentHitPoints || 10,
				armorClass: character.armorClass || 10,
				proficiencyBonus: character.proficiencyBonus || 2,
				copperPieces: character.copperPieces || 0,
				silverPieces: character.silverPieces || 0,
				electrumPieces: character.electrumPieces || 0,
				goldPieces: character.goldPieces || 0,
				platinumPieces: character.platinumPieces || 0,
				strength: character.strength || 10,
				dexterity: character.dexterity || 10,
				constitution: character.constitution || 10,
				intelligence: character.intelligence || 10,
				wisdom: character.wisdom || 10,
				charisma: character.charisma || 10,
				background: character.background || '',
				notes: character.notes || '',
				skills: character.skills || [],
				equipment: (character.equipment || []).map(e => ({
					id: e.id,
					equipmentIndex: e.equipmentIndex,
					equipmentName: e.equipmentName,
					quantity: e.quantity || 1,
					currentAmmo: e.currentAmmo,
					isEquipped: e.isEquipped !== false,
					customDamage: e.customDamage || null,
					customDescription: e.customDescription || null,
					customCost: e.customCost || null
				})),
				spells: (character.spells || []).map(s => ({
					id: s.id,
					spellIndex: s.spellIndex,
					spellName: s.spellName,
					level: s.level,
					isPrepared: s.isPrepared !== false,
					customDamage: s.customDamage || null,
					customDamageType: s.customDamageType || null,
					customDescription: s.customDescription || null
				})),
				features: (character.features || []).map(f => ({
					id: f.id,
					featureIndex: f.featureIndex,
					featureName: f.featureName,
					level: f.level
				})),
				traits: (character.traits || []).map(t => ({
					id: t.id,
					traitIndex: t.traitIndex,
					traitName: t.traitName
			})),
			languages: (character.languages || []).map(l => ({
				id: l.id,
				languageIndex: l.languageIndex,
				languageName: l.languageName
				})),
			customProperties: (character.customProperties || []).map(p => ({
				id: p.id,
				name: p.name,
				description: p.description
			})),
				spellSlots: character.spellSlots?.length > 0
					? character.spellSlots.map(s => ({
						level: s.level,
						total: s.total || 0,
						used: s.used || 0
					}))
					: defaultForm().spellSlots
			}

			// Set selected values for dropdowns
			if (character.raceIndex) {
				selectedRace.value = character.raceIndex
			} else if (character.raceName) {
				selectedRace.value = '__custom__'
			} else {
				selectedRace.value = ''
			}

			if (character.classIndex) {
				selectedClass.value = character.classIndex
			} else if (character.className) {
				selectedClass.value = '__custom__'
			} else {
				selectedClass.value = ''
			}

			selectedEquipment.value = ''
			selectedSpell.value = ''
			showModal()
		}

		function showModal() {
			if (modalRef.value && window.bootstrap) {
				modalInstance.value = new window.bootstrap.Modal(modalRef.value)
				modalInstance.value.show()
			}
		}

		function close() {
			if (modalInstance.value) {
				modalInstance.value.hide()
			}
		}

		async function submit() {
			if (!isValid.value || isSaving.value) return

			isSaving.value = true

			try {
				const characterData = {
					id: editingCharacterId.value,
					name: form.value.name.trim(),
					password: isEditing.value ? null : form.value.password,
					raceIndex: form.value.raceIndex,
					classIndex: form.value.classIndex,
					raceName: form.value.raceName,
					className: form.value.className,
					level: form.value.level,
					maxHitPoints: form.value.maxHitPoints,
					currentHitPoints: form.value.currentHitPoints,
					armorClass: form.value.armorClass,
					proficiencyBonus: form.value.proficiencyBonus,
					copperPieces: form.value.copperPieces,
					silverPieces: form.value.silverPieces,
					electrumPieces: form.value.electrumPieces,
					goldPieces: form.value.goldPieces,
					platinumPieces: form.value.platinumPieces,
					strength: form.value.strength,
					dexterity: form.value.dexterity,
					constitution: form.value.constitution,
					intelligence: form.value.intelligence,
					wisdom: form.value.wisdom,
					charisma: form.value.charisma,
					background: form.value.background,
					notes: form.value.notes,
					skills: form.value.skills,
					equipment: form.value.equipment,
					spells: form.value.spells,
					features: form.value.features,
					traits: form.value.traits,
					languages: form.value.languages,
					customProperties: form.value.customProperties,
					spellSlots: form.value.spellSlots.filter(s => s.total > 0)
				}

				if (isEditing.value) {
					await props.connection.invoke('UpdateCharacter', props.sessionId, props.userId, characterData)
				} else {
					await props.connection.invoke('CreateCharacter', props.sessionId, props.userId, characterData)
				}

				emit('character-saved')
				close()
			} catch (err) {
				console.error('Error saving character:', err)
				alert('Error saving character: ' + err.message)
			} finally {
				isSaving.value = false
			}
		}

		return {
			modalRef,
			form,
			selectedRace,
			selectedClass,
			selectedEquipment,
			selectedSpell,
			selectedFeature,
			selectedTrait,
			spellSearch,
			equipmentSearch,
			featureSearch,
			traitSearch,
			isEditing,
			isSaving,
			isValid,
			skillsGroupedByAbility,
			equipmentByCategory,
			spellsByLevel,
			featuresByLevel,
			traitsByRace,
			getModifier,
			increment,
			decrement,
			abilityLink,
			skillLink,
			equipmentLink,
			spellLink,
			featureLink,
			traitLink,
			isAmmunitionWeapon,
			getEquipmentDamage,
			addEquipment,
			addCustomEquipment,
			removeEquipment,
			equipmentMode,
			customEquipmentForm,
			spellMode,
			customSpellForm,
			addSpell,
			addCustomSpell,
			removeSpell,
			toggleSpellPrepared,
			getCharacterSpellsByLevel,
			addFeature,
			removeFeature,
			addTrait,
			removeTrait,
			selectedLanguage,
			languageSearch,
			languagesByType,
			addLanguage,
			removeLanguage,
			languageLink,
			customPropertyForm,
			addCustomProperty,
			removeCustomProperty,
			getCharacterFeaturesByLevel,
			onRaceChange,
			onClassChange,
			openForCreate,
			openForEdit,
			close,
			submit
		}
	}
}
