# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
dotnet build DndSessionManager.sln       # Build entire solution
cd DndSessionManager.Web && dotnet run   # Run web app (http://localhost:5000)
```

**WPF Host:** Set `DndSessionManager.Host` as startup project in Visual Studio and press F5.

## Architecture

**Two-project solution:**
- `DndSessionManager.Host` - WPF desktop app that hosts the web server (Windows only, .NET 8.0)
- `DndSessionManager.Web` - ASP.NET Core MVC web app with SignalR for real-time features (.NET 8.0)

**Data flow:**
```
Razor Views / Vue Components
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

## Key Directories

- `DndSessionManager.Web/Services/` - Business logic (SessionService, CharacterService, HandbookService)
- `DndSessionManager.Web/Hubs/` - SignalR hubs (LobbyHub, BrowseHub)
- `DndSessionManager.Web/Models/` - Domain entities (Session, User, Character)
- `DndSessionManager.Web/Models/GameObjects/` - D&D SRD data models (Race, Class, Spell, etc.)
- `DndSessionManager.Web/Data/` - Repository and LiteDB, plus SRD JSON files (Eng2014/, Ru2014/)
- `DndSessionManager.Web/wwwroot/ClientApp/` - Vue 3 components and i18n locales

## Conventions

- Services: `{Entity}Service.cs` with constructor-injected dependencies
- SignalR groups used for session-scoped broadcasts
- Password hashing: BCrypt.Net-Next
- Frontend: Multiple Razor view entry points with Vue components (not SPA)
- Internationalization: Vue-i18n with en.json/ru.json, backend SRD data in both languages
