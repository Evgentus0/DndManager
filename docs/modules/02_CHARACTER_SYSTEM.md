# Module: Character System

## Purpose

The Character System module is responsible for managing player characters in the D&D 5e system:
- Creating and editing characters
- Managing characteristics (ability scores, hit points, armor class)
- Equipment system
- Spell management (spells and spell slots)
- Features and traits (proficiencies, languages)
- Character ownership system (password-protected)
- Session integration

---

## Key Files

### Backend Services and Models

| File | Role | Main Methods/Properties |
|------|------|--------------------------|
| [CharacterService.cs](../../DndSessionManager.Web/Services/CharacterService.cs) | Character business logic | `CreateCharacter()`, `UpdateCharacter()`, `DeleteCharacter()`, `GetCharacter()`, `ValidatePassword()` |
| [Character.cs](../../DndSessionManager.Web/Models/Character.cs) | Main character model | `Id`, `Name`, `Class`, `Race`, `Level`, `HitPoints`, `ArmorClass`, `AbilityScores`, `Equipment`, `Spells` |
| [CharacterEquipmentItem.cs](../../DndSessionManager.Web/Models/CharacterEquipmentItem.cs) | Equipment item | `Name`, `Type`, `IsEquipped` |
| [CharacterSpellItem.cs](../../DndSessionManager.Web/Models/CharacterSpellItem.cs) | Character spell | `Name`, `Level`, `IsPrepared` |
| [CharacterSpellSlot.cs](../../DndSessionManager.Web/Models/CharacterSpellSlot.cs) | Spell slot | `Level`, `Total`, `Used` |
| [CharacterFeatureItem.cs](../../DndSessionManager.Web/Models/CharacterFeatureItem.cs) | Feature/ability | `Name`, `Description` |
| [CharacterTraitItem.cs](../../DndSessionManager.Web/Models/CharacterTraitItem.cs) | Character trait | `Name`, `Description` |
| [CharacterLanguageItem.cs](../../DndSessionManager.Web/Models/CharacterLanguageItem.cs) | Language | `Name` |

### SignalR Integration

| File | Role | Methods |
|------|------|---------|
| [LobbyHub.cs](../../DndSessionManager.Web/Hubs/LobbyHub.cs) | SignalR methods for characters | `CreateCharacter`, `UpdateCharacter`, `DeleteCharacter`, `SelectCharacter`, `ChangeCharacterPassword` |

### Frontend Components

| File | Role |
|------|------|
| [CharacterCard.js](../../DndSessionManager.Web/wwwroot/ClientApp/components/CharacterCard.js) | Character card (display) |
| [CharacterFormModal.js](../../DndSessionManager.Web/wwwroot/ClientApp/components/CharacterFormModal.js) | Create/edit modal window |
| [LobbyMyCharacterPanel.js](../../DndSessionManager.Web/wwwroot/ClientApp/components/LobbyMyCharacterPanel.js) | "My character" panel in lobby |
| [LobbyCharacterPanel.js](../../DndSessionManager.Web/wwwroot/ClientApp/components/LobbyCharacterPanel.js) | All characters panel in session |

### Composables

| File | Role |
|------|------|
| [useCharacterData.js](../../DndSessionManager.Web/wwwroot/ClientApp/composables/useCharacterData.js) | Character data logic |

---

## Character Data Structure

```csharp
public class Character
{
    // Basic information
    public Guid Id { get; set; }
    public string Name { get; set; }
    public string Class { get; set; }
    public string Race { get; set; }
    public int Level { get; set; }
    public string? PasswordHash { get; set; }

    // Ability scores
    public int Strength { get; set; }
    public int Dexterity { get; set; }
    public int Constitution { get; set; }
    public int Intelligence { get; set; }
    public int Wisdom { get; set; }
    public int Charisma { get; set; }

    // Combat stats
    public int MaxHitPoints { get; set; }
    public int CurrentHitPoints { get; set; }
    public int TemporaryHitPoints { get; set; }
    public int ArmorClass { get; set; }
    public int Initiative { get; set; }
    public int Speed { get; set; }
    public int ProficiencyBonus { get; set; }

    // Saving throws
    public Dictionary<string, bool> SavingThrows { get; set; }

    // Skills
    public Dictionary<string, bool> Skills { get; set; }

    // Collections
    public List<CharacterEquipmentItem> Equipment { get; set; }
    public List<CharacterSpellItem> Spells { get; set; }
    public List<CharacterSpellSlot> SpellSlots { get; set; }
    public List<CharacterFeatureItem> Features { get; set; }
    public List<CharacterTraitItem> Traits { get; set; }
    public List<CharacterLanguageItem> Languages { get; set; }

    // Additional
    public string? Notes { get; set; }
    public string? Background { get; set; }
    public string? Alignment { get; set; }
}
```

---

## Data Flows

### Creating a Character

```
User (LobbyMyCharacterPanel.js or CharacterFormModal.js)
    → SignalR: lobbyHub.invoke('CreateCharacter', sessionId, userId, characterData, password)
    → LobbyHub.CreateCharacter()
    → CharacterService.CreateCharacter()
        → Validate data
        → BCrypt.HashPassword() for ownership password
        → LiteDbRepository.SaveCharacter()
    → Clients.Group(sessionId).SendAsync('CharacterCreated', character)
    → All clients in session receive update
```

### Editing a Character

```
User (CharacterFormModal.js)
    → SignalR: lobbyHub.invoke('UpdateCharacter', sessionId, userId, characterId, characterData, password)
    → LobbyHub.UpdateCharacter()
    → CharacterService.ValidatePassword(characterId, password)
    → CharacterService.UpdateCharacter()
        → Update fields
        → LiteDbRepository.SaveCharacter()
    → Clients.Group(sessionId).SendAsync('CharacterUpdated', character)
    → All clients in session receive update
```

### Selecting a Character for Play

```
User (LobbyMyCharacterPanel.js)
    → SignalR: lobbyHub.invoke('SelectCharacter', sessionId, userId, characterId, password)
    → LobbyHub.SelectCharacter()
    → CharacterService.ValidatePassword(characterId, password)
    → UserService.AssignCharacterToUser(sessionId, userId, characterId)
    → Clients.Group(sessionId).SendAsync('UserCharacterSelected', userId, character)
    → All clients see which character the player selected
```

---

## API / Public Methods

### CharacterService

```csharp
// CRUD operations
Character CreateCharacter(Character character, string? password = null)
Character? GetCharacter(Guid characterId)
IEnumerable<Character> GetAllCharacters()
IEnumerable<Character> GetCharactersBySessionId(Guid sessionId)
void UpdateCharacter(Character character)
bool DeleteCharacter(Guid characterId, string? password = null)

// Ownership validation
bool ValidatePassword(Guid characterId, string password)
void ChangePassword(Guid characterId, string oldPassword, string newPassword)

// Helper methods
int CalculateAbilityModifier(int abilityScore)
int CalculateProficiencyBonus(int level)
```

### LobbyHub (SignalR methods)

```csharp
// Character management
Task CreateCharacter(string sessionId, string userId, object characterData, string? password)
Task UpdateCharacter(string sessionId, string userId, string characterId, object characterData, string password)
Task DeleteCharacter(string sessionId, string userId, string characterId, string password)
Task SelectCharacter(string sessionId, string userId, string characterId, string password)

// Password change
Task ChangeCharacterPassword(string sessionId, string userId, string characterId, string oldPassword, string newPassword)

// Quick stats updates (for fast access)
Task UpdateHitPoints(string sessionId, string userId, string characterId, int current, int temporary)
Task UpdateSpellSlots(string sessionId, string userId, string characterId, List<CharacterSpellSlot> slots)
```

---

## Common Modification Tasks

### Task 1: Add a new field to Character (e.g., "experience points")

**Files to modify:**

1. **[Character.cs](../../DndSessionManager.Web/Models/Character.cs)**
   ```csharp
   // Add property
   public int ExperiencePoints { get; set; }
   public int ExperienceToNextLevel { get; set; }
   ```

2. **[CharacterFormModal.js](../../DndSessionManager.Web/wwwroot/ClientApp/components/CharacterFormModal.js)**
   ```javascript
   // Add field to form
   const characterData = reactive({
       // ...
       experiencePoints: 0,
       experienceToNextLevel: 300
   });
   ```

3. **[CharacterCard.js](../../DndSessionManager.Web/wwwroot/ClientApp/components/CharacterCard.js)**
   ```javascript
   // Add display
   <div class="character-experience">
       <label>Experience:</label>
       <span>{{ character.experiencePoints }} / {{ character.experienceToNextLevel }}</span>
   </div>
   ```

4. **[CharacterService.cs](../../DndSessionManager.Web/Services/CharacterService.cs)**
   ```csharp
   // Add calculation method
   public int CalculateExperienceToNextLevel(int level)
   {
       // D&D 5e experience table
       return level switch
       {
           1 => 300,
           2 => 900,
           3 => 2700,
           // ... etc.
           _ => 0
       };
   }
   ```

### Task 2: Add a new equipment type (e.g., "accessories")

**Files to modify:**

1. **[CharacterEquipmentItem.cs](../../DndSessionManager.Web/Models/CharacterEquipmentItem.cs)**
   ```csharp
   // Add enum for equipment types (if not exists)
   public enum EquipmentType
   {
       Weapon,
       Armor,
       Accessory, // new type
       Consumable,
       Other
   }

   public EquipmentType Type { get; set; }
   ```

2. **[CharacterFormModal.js](../../DndSessionManager.Web/wwwroot/ClientApp/components/CharacterFormModal.js)**
   ```javascript
   // Update equipment types dropdown
   const equipmentTypes = [
       { value: 'Weapon', label: 'Weapon' },
       { value: 'Armor', label: 'Armor' },
       { value: 'Accessory', label: 'Accessory' }, // new
       { value: 'Consumable', label: 'Consumable' },
       { value: 'Other', label: 'Other' }
   ];
   ```

3. **Localization ([en.json](../../DndSessionManager.Web/wwwroot/ClientApp/locales/en.json), [ru.json](../../DndSessionManager.Web/wwwroot/ClientApp/locales/ru.json))**
   ```json
   {
       "character": {
           "equipmentTypes": {
               "accessory": "Accessory" // en.json
           }
       }
   }
   ```

### Task 3: Change spell slots logic (automatic calculation by class and level)

**Files to modify:**

1. **[CharacterService.cs](../../DndSessionManager.Web/Services/CharacterService.cs)**
   ```csharp
   public List<CharacterSpellSlot> CalculateSpellSlotsByClassAndLevel(string className, int level)
   {
       // D&D 5e spell slots table
       return className.ToLower() switch
       {
           "wizard" or "sorcerer" => GetFullCasterSlots(level),
           "cleric" or "druid" => GetFullCasterSlots(level),
           "paladin" or "ranger" => GetHalfCasterSlots(level),
           "warlock" => GetWarlockSlots(level),
           _ => new List<CharacterSpellSlot>()
       };
   }

   private List<CharacterSpellSlot> GetFullCasterSlots(int level)
   {
       // Full caster spell slots table
       // ...
   }
   ```

2. **[LobbyHub.cs](../../DndSessionManager.Web/Hubs/LobbyHub.cs)**
   ```csharp
   // Add automatic calculation method
   public async Task RecalculateSpellSlots(string sessionId, string userId, string characterId)
   {
       var character = _characterService.GetCharacter(Guid.Parse(characterId));
       if (character == null) return;

       character.SpellSlots = _characterService.CalculateSpellSlotsByClassAndLevel(
           character.Class, character.Level);

       _characterService.UpdateCharacter(character);

       await Clients.Group(sessionId).SendAsync("CharacterUpdated", character);
   }
   ```

3. **[CharacterFormModal.js](../../DndSessionManager.Web/wwwroot/ClientApp/components/CharacterFormModal.js)**
   ```javascript
   // Add automatic calculation button
   const recalculateSpellSlots = async () => {
       await lobbyHub.invoke('RecalculateSpellSlots', sessionId, userId, characterId);
   };
   ```

---

## Character Ownership System

Characters can be password-protected. This allows:
- Only the owner can edit the character
- Only the owner can delete the character
- Other players can view the character (depending on session settings)

**Ownership validation flow:**
```
User → SignalR: UpdateCharacter(characterId, data, password)
    → CharacterService.ValidatePassword(characterId, password)
        → BCrypt.Verify(password, character.PasswordHash)
        → If valid: allow operation
        → If invalid: reject with error
```

---

## Module Dependencies

### Dependencies on other modules:
- **Session Management** → Characters belong to sessions
- **Handbook System** → Uses reference data (classes, races) for validation
- **Data Layer** → ISessionRepository for persistence

### Used by:
- **Frontend UI** → Character display and editing components
- **Session Management** → Users select characters for play
