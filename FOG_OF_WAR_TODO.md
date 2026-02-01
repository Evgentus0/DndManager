# Fog of War - TODO List

## ❌ Критично (для продакшна)

### 1. Toggle Fog Enable/Disable на сервере
**Приоритет: HIGH**

**Проблема:** Toggle fog работает только локально, не синхронизируется между клиентами.

**Файлы для изменения:**
- `DndSessionManager.Web/Hubs/BattleMapHub.cs` - добавить метод `ToggleFog`
- `DndSessionManager.Web/Services/BattleMapService.cs` - добавить метод `SetFogEnabled`
- `DndSessionManager.Web/wwwroot/ClientApp/components/BattleMapContainer.js:219` - раскомментировать вызов

**Шаги:**
1. Добавить в BattleMapHub.cs:
```csharp
public async Task ToggleFog(string sessionId, string userId, bool enabled)
{
    if (!Guid.TryParse(sessionId, out var sessionGuid) ||
        !Guid.TryParse(userId, out var userGuid))
        return;

    var isMaster = _userService.IsUserMaster(sessionGuid, userGuid);
    if (!_mapService.CanUserEditMap(isMaster))
    {
        await Clients.Caller.SendAsync("BattleMapError", "Only the DM can toggle fog.");
        return;
    }

    if (_mapService.SetFogEnabled(sessionGuid, enabled))
    {
        var map = _mapService.GetBattleMapBySession(sessionGuid);
        await Clients.Group($"battlemap_{sessionId}").SendAsync("FogEnabledChanged", new
        {
            enabled = enabled,
            version = map.Version
        });
    }
}
```

2. Добавить в BattleMapService.cs:
```csharp
public bool SetFogEnabled(Guid sessionId, bool enabled)
{
    var map = GetBattleMapBySession(sessionId);
    if (map == null) return false;

    map.FogOfWar.Enabled = enabled;
    map.Version++;
    map.UpdatedAt = DateTime.UtcNow;

    SaveBattleMap(map);
    return true;
}
```

3. Добавить обработчик в BattleMapContainer.js (после FogOfWarUpdated):
```javascript
connection.value.on('FogEnabledChanged', (data) => {
    store.fogOfWar.enabled = data.enabled
})
```

4. Раскомментировать строку 220 в BattleMapContainer.js:
```javascript
await connection.value.invoke('ToggleFog', props.sessionId, props.userId, newEnabled)
```

---

## ⚠️ Опционально (улучшения)

### 2. Интеграция Vision с персонажами
**Приоритет: MEDIUM**

**Текущее состояние:**
- VisionRadius hardcoded = 10 cells для всех токенов
- CharacterId связь есть в BattleToken, но не используется
- Нет поддержки darkvision/blindsight

**Опция A: Добавить VisionRadius в BattleToken**
```csharp
// BattleMap.cs - добавить в BattleToken
public int VisionRadius { get; set; } = 10; // default 10 cells (~50ft)
```

**Опция B: Добавить Vision в Character (более правильно)**
```csharp
// Character.cs - добавить в класс Character
public int VisionRange { get; set; } = 10; // Normal vision (60ft = ~12 cells)
public int DarkvisionRange { get; set; } = 0; // Darkvision (60ft = ~12 cells)
public bool HasBlindsight { get; set; } = false;
public int BlindsightRange { get; set; } = 0;
```

Затем при создании токена из персонажа передавать visionRadius.

**Преимущества Опции B:**
- Vision характеристики персонажа хранятся вместе с персонажем
- Можно редактировать в Character Sheet
- Автоматически применяются при добавлении персонажа на карту
- Поддержка рас с Darkvision (эльфы, дварфы и т.д.)

---

### 3. Улучшения LOS алгоритма
**Приоритет: LOW**

**Возможные улучшения:**
- Поддержка Darkvision (dim light = bright light)
- Поддержка Blindsight (игнорирует стены типа Window)
- Динамическое освещение (источники света: факелы, заклинания)
- Цветной fog (gray = ранее видели, black = не видели никогда)

---

### 4. UI/UX улучшения
**Приоритет: LOW**

**Возможные улучшения:**
- Настройка размера fog brush (slider 1-5 cells)
- Undo/Redo для fog changes
- Fog presets (save/load fog state)
- Hotkeys (F для fog tool, R для reveal mode, S для shroud mode)
- Визуальный preview fog brush при hover

---

### 5. Performance оптимизации
**Приоритет: LOW**

**Текущие проблемы:**
- Fog layer cache может быть слишком большим для огромных карт
- Auto-reveal вызывается на каждое движение токена

**Возможные оптимизации:**
- Throttle auto-reveal (не чаще 1 раз в 500ms)
- Incremental fog cache updates (не пересоздавать весь layer)
- Web Workers для LOS calculation (offload от main thread)

---

## 📊 Текущий статус

**Frontend:** ✅ 100% (готово)
**Backend:** 🟡 90% (нужен ToggleFog)
**Integration:** 🟡 80% (работает, но без character vision)

**Минимально жизнеспособный продукт (MVP):** Нужен только пункт 1 (ToggleFog)

**Production-ready:** Пункты 1 + 2B (ToggleFog + Character vision integration)
