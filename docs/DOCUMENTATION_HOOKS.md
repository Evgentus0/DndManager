# Система автоматического обновления документации

## Обзор

В проект добавлена система автоматического обновления документации через PostToolUse хуки Claude Code. Система отслеживает изменения в коде и автоматически предлагает обновления для соответствующих разделов документации.

## Возможности

### Автоматическое отслеживание изменений

Система автоматически отслеживает изменения в:
- **Models** (`DndSessionManager.Web/Models/*.cs`) - свойства и структура данных
- **Services** (`DndSessionManager.Web/Services/*.cs`) - методы и бизнес-логика
- **Controllers** (`DndSessionManager.Web/Controllers/*.cs`) - HTTP endpoints
- **Hubs** (`DndSessionManager.Web/Hubs/*.cs`) - SignalR события
- **Vue Components** (`wwwroot/ClientApp/components/*.js`) - компоненты и props

### Интеллектуальный маппинг

Каждый файл кода автоматически маппится на соответствующий раздел документации:

| Файл кода | Документация | Секция |
|-----------|--------------|---------|
| `Models/Session*.cs` | `docs/modules/01_SESSION_MANAGEMENT.md` | Backend Services and Models |
| `Models/Character*.cs` | `docs/modules/02_CHARACTER_SYSTEM.md` | Backend Services and Models |
| `Services/SessionService.cs` | `docs/modules/01_SESSION_MANAGEMENT.md` | Backend Services and Models |
| `Hubs/LobbyHub.cs` | `docs/modules/01_SESSION_MANAGEMENT.md`<br>`docs/modules/03_REALTIME_COMMUNICATION.md` | SignalR |
| `wwwroot/ClientApp/components/*.js` | `docs/modules/05_FRONTEND_UI.md` | Vue Components |

### Режим Review

Все изменения проходят через режим review:
1. **Автоматический анализ** - код парсится, извлекаются методы и свойства
2. **Генерация предложений** - создаются предложенные изменения в [.claude/hooks/logs/pending-review.md](.claude/hooks/logs/pending-review.md)
3. **Проверка пользователем** - вы просматриваете diff изменений
4. **Применение** - после одобрения изменения применяются к документации

## Быстрый старт

### 1. Работа с системой

Система работает автоматически. При изменении файлов кода:

1. Хук автоматически срабатывает
2. Анализирует изменения
3. Создает pending review

### 2. Проверка pending updates

```powershell
# Просмотр ожидающих изменений
Get-Content .claude\hooks\logs\pending-review.md

# Или используйте любой текстовый редактор
code .claude\hooks\logs\pending-review.md
```

### 3. Применение изменений

```powershell
# Запустите скрипт применения
.\.claude\hooks\apply-review.ps1

# Скрипт:
# 1. Покажет все pending updates
# 2. Попросит подтверждение (введите "yes")
# 3. Применит изменения к документации
# 4. Создаст backup файлы
# 5. Очистит pending review
```

### 4. Просмотр истории

```powershell
# Просмотр всех операций
Get-Content .claude\hooks\logs\doc-updates.log
```

## Примеры использования

### Пример 1: Добавление свойства в модель

**Действие**: Добавили новое свойство `CustomProperties` в `Character.cs`

**Результат**:
```markdown
## [2026-01-31 14:30] Character.cs modified

**File**: DndSessionManager.Web/Models/Character.cs
**Documentation**: docs/modules/02_CHARACTER_SYSTEM.md
**Section**: Backend Services and Models
**Change Type**: UPDATED

### Proposed Change:
```diff
- | Character.cs | Character model | `Id`, `Name`, `Class`, `Level` |
+ | Character.cs | Character model | `Id`, `Name`, `Class`, `Level`, `CustomProperties` |
```

**Action**: Run `.\.claude\hooks\apply-review.ps1` to apply changes
```

### Пример 2: Добавление метода в сервис

**Действие**: Добавили метод `ResumeSession()` в `SessionService.cs`

**Результат**: Обновление списка методов в таблице:
```diff
- | SessionService.cs | Core business logic | `CreateSession()`, `GetSession()` |
+ | SessionService.cs | Core business logic | `CreateSession()`, `GetSession()`, `ResumeSession()` |
```

### Пример 3: Новый Vue компонент

**Действие**: Создали новый компонент `NewFeaturePanel.js`

**Результат**: Добавление новой строки в таблицу Vue Components:
```markdown
| NewFeaturePanel.js | NewFeaturePanel Vue component | - |
```

## Архитектура системы

### Структура файлов

```
.claude/
├── settings.json                           # Конфигурация PostToolUse хука
└── hooks/
    ├── README.md                          # Детальная документация
    ├── post-tool-use.ps1                  # Точка входа хука
    ├── apply-review.ps1                   # Применение изменений
    ├── doc-updater/
    │   ├── config.json                    # Маппинг файлов → документация
    │   ├── analyze-changes.ps1            # Парсер кода (C#, JS)
    │   ├── update-docs.ps1                # Обновление markdown
    │   └── templates/
    │       └── feature-doc.template       # Шаблон feature docs
    └── logs/
        ├── doc-updates.log                # Полная история операций
        └── pending-review.md              # Ожидающие одобрения изменения
```

### Поток данных

```
1. Edit/Write в коде
   ↓
2. PostToolUse hook → post-tool-use.ps1
   ↓
3. Фильтрация файла (только релевантные)
   ↓
4. config.json → определение документации
   ↓
5. analyze-changes.ps1 → парсинг кода
   ↓
6. update-docs.ps1 → генерация diff
   ↓
7. pending-review.md ← сохранение предложений
   ↓
8. [Пользователь проверяет]
   ↓
9. apply-review.ps1 → применение к .md файлам
```

## Настройка и расширение

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

- **model**: C# модели → извлекает публичные свойства
- **service**: C# сервисы → извлекает публичные методы
- **hub**: SignalR хабы → извлекает SignalR методы
- **controller**: MVC контроллеры → извлекает action методы
- **vue-component**: Vue компоненты → извлекает имя и props

### Отключение системы

Если нужно временно отключить:

```powershell
# Вариант 1: Переименовать конфигурацию
Rename-Item .claude\settings.json settings.json.disabled

# Вариант 2: Закомментировать PostToolUse в settings.json
# Откройте .claude/settings.json и закомментируйте секцию "PostToolUse"
```

## Безопасность и backup

### Автоматические backup'ы

Перед каждым изменением создается backup:
```
docs/modules/01_SESSION_MANAGEMENT.md.backup.20260131143000
```

### Откат изменений

```powershell
# Найти последний backup
Get-ChildItem docs\modules\*.backup.* | Sort-Object LastWriteTime -Descending | Select-Object -First 1

# Откатить изменения
Copy-Item "docs\modules\01_SESSION_MANAGEMENT.md.backup.20260131143000" "docs\modules\01_SESSION_MANAGEMENT.md" -Force
```

## Troubleshooting

### Хук не срабатывает

1. **Проверьте логи**:
   ```powershell
   Get-Content .claude\hooks\logs\doc-updates.log
   ```

2. **Проверьте ExecutionPolicy**:
   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
   ```

3. **Проверьте, что файл в отслеживаемой директории**:
   - Только файлы в `DndSessionManager.Web/Models/`, `Services/`, `Controllers/`, `Hubs/`, `wwwroot/ClientApp/components/`

### Ошибки парсинга

Если система не может извлечь методы/свойства:
1. Проверьте формат кода (стандартный C# или JS)
2. Убедитесь, что используются public модификаторы
3. Проверьте логи для деталей ошибки

### Проблемы с таблицами

Если обновление таблицы не работает:
1. Проверьте формат таблицы в .md файле (должны быть `|` разделители)
2. Убедитесь, что секция с правильным названием существует
3. Проверьте маппинг в `config.json`

## Ограничения текущей версии (v1.0.0 MVP)

1. **Regex-парсинг**: Использует регулярные выражения, может пропустить сложные конструкции
2. **Только таблицы**: Обновляет только таблицы в разделах, не обновляет Data Flows
3. **Ручной review**: Требуется ручное одобрение для применения
4. **Windows**: Работает только на Windows (PowerShell скрипты)

## Планы развития

### v1.1.0
- Интеграция Claude API для семантического анализа
- Автоматическое обновление секций Data Flows
- Обнаружение новых фич и создание feature docs

### v1.2.0
- Поддержка Linux/macOS (bash скрипты)
- Авто-применение безопасных изменений (без review)
- Интеграция с git hooks

### v2.0.0
- Генерация примеров кода в Common Tasks
- Создание changelog автоматически
- Visual Studio Code extension

## Ссылки

- Полная документация: [.claude/hooks/README.md](.claude/hooks/README.md)
- План реализации: [C:\Users\zerom\.claude\plans\snappy-puzzling-ripple.md](C:\Users\zerom\.claude\plans\snappy-puzzling-ripple.md)
- Конфигурация: [.claude/hooks/doc-updater/config.json](.claude/hooks/doc-updater/config.json)
