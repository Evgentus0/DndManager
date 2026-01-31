# Documentation Auto-Update Hook System

Автоматическая система обновления документации при изменениях в коде.

## Как это работает

1. **PostToolUse Hook**: Триггерится после каждого Edit/Write в файлах кода
2. **Анализ изменений**: Парсинг кода для извлечения методов, свойств, классов
3. **Маппинг**: Определение, какие файлы документации нужно обновить
4. **Pending Review**: Создание предложенных изменений для проверки
5. **Apply Review**: Применение одобренных изменений

## Структура

```
.claude/
├── settings.json                    # Конфигурация PostToolUse хука
├── hooks/
│   ├── post-tool-use.ps1           # Основной обработчик хука
│   ├── apply-review.ps1            # Применение изменений
│   ├── doc-updater/
│   │   ├── config.json             # Маппинг файлов → документация
│   │   ├── analyze-changes.ps1     # Парсинг кода
│   │   ├── update-docs.ps1         # Обновление .md файлов
│   │   └── templates/
│   │       └── feature-doc.template
│   └── logs/
│       ├── doc-updates.log         # Лог всех операций
│       └── pending-review.md       # Ожидающие одобрения изменения
```

## Использование

### 1. Автоматическое срабатывание

Хук автоматически срабатывает при изменении файлов в:
- `DndSessionManager.Web/Models/*.cs`
- `DndSessionManager.Web/Services/*.cs`
- `DndSessionManager.Web/Controllers/*.cs`
- `DndSessionManager.Web/Hubs/*.cs`
- `DndSessionManager.Web/wwwroot/ClientApp/components/*.js`

### 2. Проверка pending updates

После изменения файлов проверьте:

```powershell
Get-Content .claude\hooks\logs\pending-review.md
```

### 3. Применение изменений

Просмотрите предложенные изменения и примените их:

```powershell
.\.claude\hooks\apply-review.ps1
```

Скрипт:
1. Покажет все pending updates
2. Попросит подтверждение (введите `yes`)
3. Применит изменения к документации
4. Создаст backup файлы
5. Очистит pending review

### 4. Просмотр логов

```powershell
Get-Content .claude\hooks\logs\doc-updates.log
```

## Конфигурация

### Добавление нового маппинга

Отредактируйте [.claude/hooks/doc-updater/config.json](.claude/hooks/doc-updater/config.json):

```json
{
  "pattern": "DndSessionManager.Web/Models/MyNewModel.cs",
  "docs": ["docs/modules/MY_MODULE.md"],
  "tableSection": "Backend Services and Models",
  "updateType": "model"
}
```

### Типы обновлений

- `model`: C# модели (извлекает свойства)
- `service`: C# сервисы (извлекает методы)
- `hub`: SignalR хабы (извлекает SignalR методы)
- `controller`: MVC контроллеры (извлекает action методы)
- `vue-component`: Vue компоненты (извлекает props)

## Примеры

### Пример 1: Добавление свойства в модель

**Изменение**: Добавлено свойство `NewProperty` в `Character.cs`

**Результат в pending-review.md**:
```markdown
## [2026-01-31 14:30] Character.cs modified

**File**: DndSessionManager.Web/Models/Character.cs
**Documentation**: docs/modules/02_CHARACTER_SYSTEM.md
**Section**: Backend Services and Models
**Change Type**: UPDATED

### Proposed Change:
```diff
- | Character.cs | Character model | `Id`, `Name`, `Class` |
+ | Character.cs | Character model | `Id`, `Name`, `Class`, `NewProperty` |
```
```

### Пример 2: Добавление метода в сервис

**Изменение**: Добавлен метод `NewMethod()` в `SessionService.cs`

**Результат**: Обновление списка методов в таблице Backend Services and Models

## Отключение хука

Если нужно временно отключить хук:

1. Переименуйте [.claude/settings.json](.claude/settings.json) в `settings.json.disabled`
2. ИЛИ закомментируйте секцию `PostToolUse` в settings.json

## Troubleshooting

### Хук не срабатывает

1. Проверьте, что файл находится в отслеживаемых директориях
2. Проверьте логи: `.claude\hooks\logs\doc-updates.log`
3. Убедитесь, что PowerShell может выполнять скрипты: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`

### Ошибки в pending review

1. Проверьте формат таблиц в документации (должны быть `|` разделители)
2. Убедитесь, что секция с нужным названием существует
3. Проверьте конфигурацию маппинга в `config.json`

### Backup файлы

Backup файлы создаются автоматически с именем `.md.backup.TIMESTAMP`.
Для отката изменений просто скопируйте backup обратно:

```powershell
Copy-Item docs\modules\01_SESSION_MANAGEMENT.md.backup.20260131143000 docs\modules\01_SESSION_MANAGEMENT.md
```

## Расширение системы

### Добавление нового типа файлов

1. Добавьте паттерн фильтрации в [post-tool-use.ps1](post-tool-use.ps1)
2. Добавьте маппинг в [config.json](doc-updater/config.json)
3. Добавьте логику парсинга в [analyze-changes.ps1](doc-updater/analyze-changes.ps1)

### Интеграция Claude API (опционально)

Для более интеллектуального анализа можно добавить интеграцию с Claude API:
1. Создайте `doc-updater/claude-api.ps1`
2. Добавьте API ключ в переменную окружения `ANTHROPIC_API_KEY`
3. Используйте API для семантического анализа изменений

## Версия

v1.0.0 - MVP (Minimum Viable Product)

## Обратная связь

Если у вас есть предложения по улучшению системы, создайте issue или обновите документацию.
