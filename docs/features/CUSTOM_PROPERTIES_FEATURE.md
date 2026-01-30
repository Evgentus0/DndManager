# Custom Properties Feature

## Overview

Added ability for players to create custom properties/characteristics for their characters. This allows adding any special abilities, quirks, or unique traits that aren't covered by standard D&D 5e rules.

## Implementation

### Backend Changes

#### 1. New Model: [CharacterCustomPropertyItem.cs](../DndSessionManager.Web/Models/CharacterCustomPropertyItem.cs)
```csharp
public class CharacterCustomPropertyItem
{
    public Guid Id { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
}
```

#### 2. Updated [Character.cs](../DndSessionManager.Web/Models/Character.cs)
Added new property:
```csharp
public List<CharacterCustomPropertyItem> CustomProperties { get; set; } = new();
```

### Frontend Changes

#### 1. [CharacterFormModal.js](../DndSessionManager.Web/wwwroot/ClientApp/components/CharacterFormModal.js)
- Added form section for creating custom properties
- Added `customPropertyForm` reactive object
- Added `addCustomProperty()` function
- Added `removeCustomProperty()` function
- Updated `defaultForm()` to include `customProperties: []`
- Updated `openForEdit()` to load custom properties
- Updated `submit()` to save custom properties

#### 2. [CharacterCard.js](../DndSessionManager.Web/wwwroot/ClientApp/components/CharacterCard.js)
- Added display section for custom properties
- Shows property name and description in card format

### Localization

#### Added translations to both [en.json](../DndSessionManager.Web/wwwroot/ClientApp/locales/en.json) and [ru.json](../DndSessionManager.Web/wwwroot/ClientApp/locales/ru.json):

**English:**
- `customProperties`: "Custom Properties"
- `customPropertyName`: "Property Name"
- `customPropertyNamePlaceholder`: "Enter property name (e.g., Special Ability, Quirk)"
- `customPropertyDescription`: "Description"
- `customPropertyDescriptionPlaceholder`: "Enter description or details"
- `addCustomProperty`: "Add Property"

**Russian:**
- `customProperties`: "Кастомные характеристики"
- `customPropertyName`: "Название характеристики"
- `customPropertyNamePlaceholder`: "Введите название (например, Особая способность, Причуда)"
- `customPropertyDescription`: "Описание"
- `customPropertyDescriptionPlaceholder`: "Введите описание или детали"
- `addCustomProperty`: "Добавить характеристику"

## Usage

### Creating Custom Properties

1. Open character creation/edit modal
2. Scroll to "Custom Properties" section
3. Enter property name (e.g., "Lucky", "Dark Vision", "Werewolf Curse")
4. Enter description (optional)
5. Click "Add Property" button
6. Property appears in the list below

### Viewing Custom Properties

Custom properties are displayed on the character card after Languages section, showing:
- Property name in bold
- Property description in smaller text below

### Deleting Custom Properties

Click the trash button next to any custom property in the edit form to remove it.

## Data Structure

Custom properties are stored as part of the Character object in LiteDB:
```json
{
  "customProperties": [
    {
      "id": "guid-here",
      "name": "Lucky",
      "description": "Once per day, can reroll any d20"
    }
  ]
}
```

## Notes

- Custom properties are completely freeform
- No validation on content (players can add anything)
- Stored in database with character data
- Persists across sessions
