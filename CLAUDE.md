# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start

### Build & Run Commands

```bash
dotnet build DndSessionManager.sln       # Build entire solution
cd DndSessionManager.Web && dotnet run   # Run web app (http://localhost:5000)
```

**WPF Host:** Set `DndSessionManager.Host` as startup project in Visual Studio and press F5.

---

## Architecture

**Two-project solution:**
- [DndSessionManager.Host](DndSessionManager.Host) - WPF desktop app that hosts the web server (Windows only, .NET 8.0)
- [DndSessionManager.Web](DndSessionManager.Web) - ASP.NET Core MVC web app with SignalR for real-time features (.NET 8.0)

**Data flow:**
```
Razor Views / Vue Components (JS)
         ↓
Controllers & SignalR Hubs (LobbyHub, BrowseHub)
         ↓
Services (SessionService, UserService, CharacterService, HandbookService)
         ↓
LiteDbRepository → LiteDB (Data/db/dndmanager.db)
```

**State management:**
- Active sessions: ConcurrentDictionary in SessionService (in-memory) + LiteDB persistence
- Users: Ephemeral, stored in Session.Users list
- Characters: LiteDB only
- Chat messages: ConcurrentDictionary + LiteDB persistence

**Real-time updates:** SignalR push model via HubCallerService (no polling)

---

## Modular Structure

The project is divided into 6 logical modules. For detailed study of each module, see documentation:

### 1. [Session Management](docs/modules/01_SESSION_MANAGEMENT.md)
Managing game sessions:
- Creating, browsing, joining sessions
- Managing users and access rights (Master/Player)
- Real-time chat
- Saving and resuming sessions

**Key files:** [SessionService.cs](DndSessionManager.Web/Services/SessionService.cs), [LobbyHub.cs](DndSessionManager.Web/Hubs/LobbyHub.cs), [Session.cs](DndSessionManager.Web/Models/Session.cs)

### 2. [Character System](docs/modules/02_CHARACTER_SYSTEM.md)
D&D 5e character system:
- Creating and editing characters
- Managing equipment, spells, abilities
- Ownership system (password-protected)
- Session integration

**Key files:** [CharacterService.cs](DndSessionManager.Web/Services/CharacterService.cs), [Character.cs](DndSessionManager.Web/Models/Character.cs)

### 3. [Real-time Communication](docs/modules/03_REALTIME_COMMUNICATION.md)
SignalR communication:
- SignalR hubs (LobbyHub, BrowseHub)
- Groups and broadcast updates
- Connection/disconnection handling
- Push notifications via HubCallerService

**Key files:** [LobbyHub.cs](DndSessionManager.Web/Hubs/LobbyHub.cs), [HubCallerService.cs](DndSessionManager.Web/Services/HubCallerService.cs)

### 4. [D&D Handbook System](docs/modules/04_HANDBOOK_SYSTEM.md)
D&D 5e SRD reference:
- Races, classes, spells, equipment
- In-memory caching (IMemoryCache)
- Multi-language support (EN/RU)
- JSON data from SRD

**Key files:** [HandbookService.cs](DndSessionManager.Web/Services/HandbookService.cs), [HandbookController.cs](DndSessionManager.Web/Controllers/HandbookController.cs), [Data/Eng2014/](DndSessionManager.Web/Data/Eng2014), [Data/Ru2014/](DndSessionManager.Web/Data/Ru2014)

### 5. [Frontend UI](docs/modules/05_FRONTEND_UI.md)
Vue 3 components and UI:
- 16+ Vue components (Composition API)
- Internationalization (vue-i18n)
- Razor views integration
- Composables for logic reuse

**Key files:** [wwwroot/ClientApp/components/](DndSessionManager.Web/wwwroot/ClientApp/components), [locales/](DndSessionManager.Web/wwwroot/ClientApp/locales)

### 6. [Host Application](docs/modules/06_HOST_APPLICATION.md)
WPF desktop wrapper:
- ASP.NET Core app hosting
- Server lifecycle management
- WebView2 integration (optional)

**Key files:** [DndSessionManager.Host/](DndSessionManager.Host)

---

## Key Directories

### Backend (C#)
- [DndSessionManager.Web/Services/](DndSessionManager.Web/Services) - Business logic
- [DndSessionManager.Web/Hubs/](DndSessionManager.Web/Hubs) - SignalR hubs
- [DndSessionManager.Web/Controllers/](DndSessionManager.Web/Controllers) - MVC controllers
- [DndSessionManager.Web/Models/](DndSessionManager.Web/Models) - Domain models
- [DndSessionManager.Web/Models/GameObjects/](DndSessionManager.Web/Models/GameObjects) - SRD data models
- [DndSessionManager.Web/Data/](DndSessionManager.Web/Data) - Repository and LiteDB
- [DndSessionManager.Web/Views/](DndSessionManager.Web/Views) - Razor views

### Frontend (Vue 3)
- [DndSessionManager.Web/wwwroot/ClientApp/components/](DndSessionManager.Web/wwwroot/ClientApp/components) - Vue components
- [DndSessionManager.Web/wwwroot/ClientApp/composables/](DndSessionManager.Web/wwwroot/ClientApp/composables) - Vue composables
- [DndSessionManager.Web/wwwroot/ClientApp/locales/](DndSessionManager.Web/wwwroot/ClientApp/locales) - i18n files

### Data
- [DndSessionManager.Web/Data/Eng2014/](DndSessionManager.Web/Data/Eng2014) - SRD JSON (English)
- [DndSessionManager.Web/Data/Ru2014/](DndSessionManager.Web/Data/Ru2014) - SRD JSON (Russian)
- `DndSessionManager.Web/Data/db/` - LiteDB files (in .gitignore)

---

## Code Conventions

### Backend
- **Services:** `{Entity}Service.cs` with constructor-injected dependencies
- **SignalR:** Groups used for session-scoped broadcasts
- **Password hashing:** BCrypt.Net-Next
- **Models:** Nullable reference types enabled

### Frontend
- **Not SPA:** Multiple Razor view entry points with Vue components
- **Internationalization:** Vue-i18n with en.json/ru.json, backend SRD data in both languages
- **Components:** ES6 modules, exported as `{ component, setup }`

---

## Common Tasks

### Adding new session feature
See [Session Management - Common Tasks](docs/modules/01_SESSION_MANAGEMENT.md#common-modification-tasks)

### Adding new character field
See [Character System - Common Tasks](docs/modules/02_CHARACTER_SYSTEM.md#common-modification-tasks)

### Adding new SRD type
See [Handbook System - Common Tasks](docs/modules/04_HANDBOOK_SYSTEM.md#common-modification-tasks)

### Adding new Vue component
See [Frontend UI - Common Tasks](docs/modules/05_FRONTEND_UI.md#common-modification-tasks)

---

## Useful Links

- [D&D 5e SRD API](https://www.dnd5eapi.co/)
- [LiteDB Documentation](https://www.litedb.org/)
- [SignalR Documentation](https://docs.microsoft.com/en-us/aspnet/core/signalr/)
- [Vue 3 Documentation](https://vuejs.org/)
- [Vue-i18n Documentation](https://vue-i18n.intlify.dev/)
