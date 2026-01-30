# Module: D&D Handbook System

## Purpose

The Handbook System provides D&D 5e SRD (System Reference Document) data:
- Races, classes, spells, equipment, and other game objects
- Multi-language support (English and Russian)
- In-memory caching for performance
- JSON-based data storage
- API for accessing handbook data

---

## Key Files

### Backend Services and Controllers

| File | Role | Main Methods |
|------|------|--------------|
| [HandbookService.cs](../../DndSessionManager.Web/Services/HandbookService.cs) | Business logic and caching | `GetEntities<T>()`, `GetEntity<T>()`, `LoadFromJson<T>()` |
| [HandbookController.cs](../../DndSessionManager.Web/Controllers/HandbookController.cs) | HTTP API endpoints | `Index`, `GetData`, `GetEntity` |

### Models (GameObjects)

| File | Description |
|------|-------------|
| [BaseGameObject.cs](../../DndSessionManager.Web/Models/GameObjects/BaseGameObject.cs) | Base class for all SRD objects |
| [Class.cs](../../DndSessionManager.Web/Models/GameObjects/Class.cs) | D&D class (Wizard, Fighter, etc.) |
| [Race.cs](../../DndSessionManager.Web/Models/GameObjects/Race.cs) | D&D race (Human, Elf, etc.) |
| [Spell.cs](../../DndSessionManager.Web/Models/GameObjects/Spell.cs) | Magic spell |
| [AbilityScore.cs](../../DndSessionManager.Web/Models/GameObjects/AbilityScore.cs) | Ability score (STR, DEX, etc.) |
| *(Other GameObjects)* | Equipment, features, traits, etc. |

### Data Files

| Directory | Description |
|-----------|-------------|
| [Data/Eng2014/](../../DndSessionManager.Web/Data/Eng2014) | SRD JSON files in English |
| [Data/Ru2014/](../../DndSessionManager.Web/Data/Ru2014) | SRD JSON files in Russian |

### Frontend

| File | Role |
|------|------|
| [Handbook/Index.cshtml](../../DndSessionManager.Web/Views/Handbook/Index.cshtml) | Handbook page view |
| [HandbookContainer.js](../../DndSessionManager.Web/wwwroot/ClientApp/components/HandbookContainer.js) | Main handbook Vue component |
| [EntityList.js](../../DndSessionManager.Web/wwwroot/ClientApp/components/EntityList.js) | List of entities |
| [EntityDetail.js](../../DndSessionManager.Web/wwwroot/ClientApp/components/EntityDetail.js) | Entity detail view |
| [SearchBar.js](../../DndSessionManager.Web/wwwroot/ClientApp/components/SearchBar.js) | Search functionality |
| [TabNavigation.js](../../DndSessionManager.Web/wwwroot/ClientApp/components/TabNavigation.js) | Tab navigation |

---

## Data Structure

### BaseGameObject

```csharp
public abstract class BaseGameObject
{
    public string Index { get; set; }      // Unique identifier (e.g., "fireball")
    public string Name { get; set; }       // Display name
    public string Url { get; set; }        // API URL
    public string? Description { get; set; }
}
```

### Example: Spell

```csharp
public class Spell : BaseGameObject
{
    public int Level { get; set; }
    public string School { get; set; }
    public string CastingTime { get; set; }
    public string Range { get; set; }
    public string Duration { get; set; }
    public bool Concentration { get; set; }
    public bool Ritual { get; set; }
    public List<string> Components { get; set; }
    public string? Material { get; set; }
    public List<string> Classes { get; set; }
}
```

---

## Caching Strategy

The HandbookService uses `IMemoryCache` to cache SRD data:

```csharp
public class HandbookService
{
    private readonly IMemoryCache _cache;
    private readonly string _dataPath;

    public IEnumerable<T> GetEntities<T>(string language) where T : BaseGameObject
    {
        var cacheKey = $"{typeof(T).Name}_{language}";

        if (!_cache.TryGetValue(cacheKey, out IEnumerable<T> entities))
        {
            entities = LoadFromJson<T>(language);

            _cache.Set(cacheKey, entities, new MemoryCacheEntryOptions
            {
                SlidingExpiration = TimeSpan.FromHours(24),
                Priority = CacheItemPriority.Normal
            });
        }

        return entities;
    }
}
```

**Cache Key Format:** `{TypeName}_{Language}` (e.g., `Spell_en`, `Race_ru`)

**Cache Expiration:** 24 hours sliding expiration

---

## Multi-language Support

Data is stored in separate directories:
- `Data/Eng2014/` - English SRD data
- `Data/Ru2014/` - Russian SRD data

**File naming convention:** `{type}s.json` (e.g., `spells.json`, `races.json`)

**Language selection:**
- Frontend: User selects language via `LanguageSelector.js`
- Backend: API accepts `language` parameter (default: `en`)

---

## API Endpoints

### HandbookController

```csharp
// Get all entities of a type
GET /Handbook/GetData?type={type}&language={language}
// Example: /Handbook/GetData?type=spells&language=en

// Get single entity by index
GET /Handbook/GetEntity?type={type}&index={index}&language={language}
// Example: /Handbook/GetEntity?type=spells&index=fireball&language=en

// Handbook page
GET /Handbook/Index
```

---

## Common Modification Tasks

### Task 1: Add a new SRD type (e.g., "Feats")

**Files to create/modify:**

1. **Create Model: [Feat.cs](../../DndSessionManager.Web/Models/GameObjects/Feat.cs)**
   ```csharp
   public class Feat : BaseGameObject
   {
       public List<string> Prerequisites { get; set; }
       public List<string> Benefits { get; set; }
   }
   ```

2. **Add JSON data:**
   - Create `Data/Eng2014/feats.json`
   - Create `Data/Ru2014/feats.json`

   ```json
   [
       {
           "index": "grappler",
           "name": "Grappler",
           "url": "/api/feats/grappler",
           "description": "You've developed skills for grappling",
           "prerequisites": ["Strength 13 or higher"],
           "benefits": [
               "Advantage on attack rolls against grappled creatures",
               "You can use your action to pin a grappled creature"
           ]
       }
   ]
   ```

3. **Update [HandbookService.cs](../../DndSessionManager.Web/Services/HandbookService.cs)**
   ```csharp
   // No changes needed - generic method handles all types
   ```

4. **Update [HandbookController.cs](../../DndSessionManager.Web/Controllers/HandbookController.cs)**
   ```csharp
   // Add case for "feats"
   public IActionResult GetData(string type, string language = "en")
   {
       return type.ToLower() switch
       {
           "spells" => Json(_handbookService.GetEntities<Spell>(language)),
           "races" => Json(_handbookService.GetEntities<Race>(language)),
           "classes" => Json(_handbookService.GetEntities<Class>(language)),
           "feats" => Json(_handbookService.GetEntities<Feat>(language)), // new
           _ => NotFound()
       };
   }
   ```

5. **Update Frontend [HandbookContainer.js](../../DndSessionManager.Web/wwwroot/ClientApp/components/HandbookContainer.js)**
   ```javascript
   const tabs = [
       { id: 'spells', label: 'Spells' },
       { id: 'races', label: 'Races' },
       { id: 'classes', label: 'Classes' },
       { id: 'feats', label: 'Feats' } // new
   ];
   ```

### Task 2: Update SRD data

**Steps:**

1. Edit JSON files in `Data/Eng2014/` or `Data/Ru2014/`
2. Restart application (to clear cache) OR implement cache invalidation

**Optional: Add cache invalidation endpoint:**
```csharp
[HttpPost]
public IActionResult InvalidateCache()
{
    _handbookService.ClearCache();
    return Ok();
}
```

### Task 3: Add third language (e.g., German)

**Files to create/modify:**

1. **Create directory:** `Data/Ger2014/`
2. **Add JSON files:** Copy from `Data/Eng2014/` and translate
3. **Update [HandbookService.cs](../../DndSessionManager.Web/Services/HandbookService.cs)**
   ```csharp
   private string GetDataPath(string language)
   {
       return language.ToLower() switch
       {
           "en" => "Data/Eng2014",
           "ru" => "Data/Ru2014",
           "de" => "Data/Ger2014", // new
           _ => "Data/Eng2014"
       };
   }
   ```

4. **Update Frontend [LanguageSelector.js](../../DndSessionManager.Web/wwwroot/ClientApp/components/LanguageSelector.js)**
   ```javascript
   const languages = [
       { code: 'en', name: 'English' },
       { code: 'ru', name: 'Русский' },
       { code: 'de', name: 'Deutsch' } // new
   ];
   ```

---

## Performance Considerations

1. **Caching:** All SRD data is cached in memory after first load
2. **Lazy Loading:** Data is loaded only when requested (per type, per language)
3. **JSON Serialization:** Uses `System.Text.Json` for fast deserialization
4. **Static Files:** JSON files are embedded in the application (no database queries)

---

## Module Dependencies

### Dependencies on other modules:
- None (standalone module)

### Used by:
- **Character System** → Validates class/race names against handbook data
- **Frontend UI** → Handbook components display SRD data
