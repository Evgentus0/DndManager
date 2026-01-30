# Module: Session Management

## Purpose

The Session Management module is responsible for the complete lifecycle of D&D game sessions:
- Creating new sessions with settings (passwords, player limits)
- Browsing available sessions (active and saved)
- Joining players to sessions
- Managing session state (Active/Saved)
- Saving and resuming sessions
- Managing users (Master/Player roles)
- Real-time chat

---

## Key Files

### Backend Services and Models

| File | Role | Main Methods/Properties |
|------|------|--------------------------|
| [SessionService.cs](../../DndSessionManager.Web/Services/SessionService.cs) | Core business logic for sessions | `CreateSession()`, `ResumeSession()`, `SaveAndDeactivateSession()`, `AddUserToSession()`, `AddChatMessage()` |
| [UserService.cs](../../DndSessionManager.Web/Services/UserService.cs) | Managing users in sessions | `AddUser()`, `GetUser()`, `IsUserMaster()` |
| [Session.cs](../../DndSessionManager.Web/Models/Session.cs) | Session model | `Id`, `Name`, `PasswordHash`, `MasterPasswordHash`, `MaxPlayers`, `Users`, `State`, `MasterNotes` |
| [User.cs](../../DndSessionManager.Web/Models/User.cs) | User model | `Id`, `Username`, `Role`, `ConnectionId` |
| [ChatMessage.cs](../../DndSessionManager.Web/Models/ChatMessage.cs) | Chat message model | `SessionId`, `Username`, `Message`, `Timestamp` |
| [SessionState.cs](../../DndSessionManager.Web/Models/SessionState.cs) | State enum | `Active`, `Saved` |
| [UserRole.cs](../../DndSessionManager.Web/Models/UserRole.cs) | Role enum | `Master`, `Player` |

### Controllers

| File | Role | Main Endpoints |
|------|------|----------------|
| [SessionController.cs](../../DndSessionManager.Web/Controllers/SessionController.cs) | HTTP endpoints for sessions | `Browse`, `Create`, `Join`, `Lobby`, `Resume`, `Delete` |

### SignalR

| File | Role | Events |
|------|------|--------|
| [LobbyHub.cs](../../DndSessionManager.Web/Hubs/LobbyHub.cs) | Real-time communication in session | `JoinLobby`, `LeaveLobby`, `SendMessage`, `KickUser`, `ToggleSessionOpen` |
| [BrowseHub.cs](../../DndSessionManager.Web/Hubs/BrowseHub.cs) | Session list updates | (empty hub, used only for broadcasts) |

### Views

| File | Role |
|------|------|
| [Browse.cshtml](../../DndSessionManager.Web/Views/Session/Browse.cshtml) | List of available sessions |
| [Create.cshtml](../../DndSessionManager.Web/Views/Session/Create.cshtml) | Session creation form |
| [Join.cshtml](../../DndSessionManager.Web/Views/Session/Join.cshtml) | Session join form |
| [Resume.cshtml](../../DndSessionManager.Web/Views/Session/Resume.cshtml) | Saved session resume form |
| [Lobby.cshtml](../../DndSessionManager.Web/Views/Session/Lobby.cshtml) | Main game session page |

### Frontend Components

| File | Role |
|------|------|
| [LobbyChatPanel.js](../../DndSessionManager.Web/wwwroot/ClientApp/components/LobbyChatPanel.js) | Chat panel in lobby |
| [LobbyMasterNotesPanel.js](../../DndSessionManager.Web/wwwroot/ClientApp/components/LobbyMasterNotesPanel.js) | Master notes panel |
| [SessionLink.js](../../DndSessionManager.Web/wwwroot/ClientApp/components/SessionLink.js) | Session link component |

---

## Data Flows

### Creating a Session

```
User (Browse.cshtml)
    → POST /Session/Create { name, password, masterPassword, maxPlayers, description }
    → SessionController.Create()
    → SessionService.CreateSession()
        → BCrypt.HashPassword() for passwords
        → Add to _activeSessions (ConcurrentDictionary)
        → LiteDbRepository.SaveSession()
        → HubCallerService.BrowseRefreshAvailableSessionsList()
    → Redirect to /Session/Join
```

### Joining a Session

```
User (Join.cshtml)
    → POST /Session/Join { sessionId, username, password, role }
    → SessionController.Join()
    → SessionService.ValidateSessionPassword() or ValidateMasterPassword()
    → SessionService.AddUserToSession()
        → Check IsOpen and MaxPlayers
        → Add User to Session.Users
    → Save userId/role in HttpContext.Session
    → Redirect to /Session/Lobby or /Session/CharacterSelect
```

### Real-time Chat

```
User sends message (LobbyChatPanel.js)
    → SignalR: lobbyHub.invoke('SendMessage', sessionId, userId, message)
    → LobbyHub.SendMessage()
    → UserService.GetUser() for validation
    → SessionService.AddChatMessage()
        → Add to _chatMessages (ConcurrentDictionary)
    → Clients.Group(sessionId).SendAsync('ReceiveMessage', { username, message, timestamp })
    → All clients in group receive 'ReceiveMessage' event
    → LobbyChatPanel.js updates UI
```

### Saving a Session

```
Master leaves session (or explicit save)
    → SessionService.RemoveUserFromSession(sessionId, masterId)
    → SessionService.SaveAndDeactivateSession()
        → Session.State = SessionState.Saved
        → Session.LastSavedAt = DateTime.UtcNow
        → Session.IsOpen = false
        → LiteDbRepository.SaveSession()
        → LiteDbRepository.SaveChatMessages()
        → Remove from _activeSessions
        → HubCallerService.BrowseRefreshAvailableSessionsList()
```

---

## API / Public Methods

### SessionService

```csharp
// Session creation and management
Session CreateSession(string name, string joinPassword, string masterPassword,
    int maxPlayers, string? description, Guid masterId, string masterUsername)
Session? GetSession(Guid sessionId)
Session? GetSessionFromDb(Guid sessionId)
IEnumerable<Session> GetActiveSessions()
IEnumerable<Session> GetAllSessionsForBrowse()
Session? ResumeSession(Guid sessionId)
void SaveAndDeactivateSession(Guid sessionId)
bool DeleteSession(Guid sessionId)
bool DeleteSavedSession(Guid sessionId)

// User management
bool AddUserToSession(Guid sessionId, User user)
bool RemoveUserFromSession(Guid sessionId, Guid userId)

// Validation
bool ValidateSessionPassword(Guid sessionId, string password)
bool ValidateMasterPassword(Guid sessionId, string password)

// Chat
void AddChatMessage(ChatMessage message)
IEnumerable<ChatMessage> GetChatMessages(Guid sessionId)

// Settings
void UpdateSessionOpen(Guid sessionId, bool isOpen)
void UpdateSessionNotes(Guid sessionId, string notes)

// Application lifecycle
void ShutdownAllSessions()
```

### UserService

```csharp
void AddUser(Guid sessionId, User user)
User? GetUser(Guid sessionId, Guid userId)
bool IsUserMaster(Guid sessionId, Guid userId)
void UpdateConnectionId(Guid sessionId, Guid userId, string connectionId)
```

### LobbyHub (SignalR methods)

```csharp
Task JoinLobby(string sessionId, string userId)
Task LeaveLobby(string sessionId, string userId)
Task SendMessage(string sessionId, string userId, string message)
Task KickUser(string sessionId, string masterUserId, string targetUserId)
Task ToggleSessionOpen(string sessionId, string masterUserId, bool isOpen)
Task SaveMasterNotes(string sessionId, string masterUserId, string notes)
Task LoadMasterNotes(string sessionId, string masterUserId)
```

---

## Common Modification Tasks

### Task 1: Add a new field to Session (e.g., "maximum duration")

**Files to modify:**

1. **[Session.cs](../../DndSessionManager.Web/Models/Session.cs:15)**
   ```csharp
   // Add property
   public int? MaxDurationMinutes { get; set; }
   ```

2. **[Create.cshtml](../../DndSessionManager.Web/Views/Session/Create.cshtml)**
   ```html
   <!-- Add form field -->
   <div class="form-group">
       <label asp-for="MaxDurationMinutes">Maximum Duration (minutes)</label>
       <input asp-for="MaxDurationMinutes" class="form-control" type="number" />
   </div>
   ```

3. **[SessionController.cs](../../DndSessionManager.Web/Controllers/SessionController.cs)**
   ```csharp
   // Add parameter to Create action
   public async Task<IActionResult> Create(string name, string password, string masterPassword,
       int maxPlayers, string? description, int? maxDurationMinutes)
   {
       // ...
       var session = _sessionService.CreateSession(name, password, masterPassword,
           maxPlayers, description, userId, username, maxDurationMinutes);
       // ...
   }
   ```

4. **[SessionService.cs](../../DndSessionManager.Web/Services/SessionService.cs)**
   ```csharp
   // Update CreateSession signature
   public Session CreateSession(string name, string joinPassword, string masterPassword,
       int maxPlayers, string? description, Guid masterId, string masterUsername,
       int? maxDurationMinutes = null)
   {
       var session = new Session
       {
           // ...
           MaxDurationMinutes = maxDurationMinutes
       };
       // ...
   }
   ```

### Task 2: Add a new SignalR event (e.g., "master changed session name")

**Files to modify:**

1. **[LobbyHub.cs](../../DndSessionManager.Web/Hubs/LobbyHub.cs)**
   ```csharp
   public async Task UpdateSessionName(string sessionId, string masterUserId, string newName)
   {
       if (!Guid.TryParse(sessionId, out var sessionGuid) ||
           !Guid.TryParse(masterUserId, out var masterUserGuid))
           return;

       if (!_userService.IsUserMaster(sessionGuid, masterUserGuid))
           return;

       var session = _sessionService.GetSession(sessionGuid);
       if (session == null) return;

       session.Name = newName;
       _sessionService.UpdateSession(session);

       await Clients.Group(sessionId).SendAsync("SessionNameChanged", newName);
   }
   ```

2. **[SessionService.cs](../../DndSessionManager.Web/Services/SessionService.cs)**
   ```csharp
   public void UpdateSession(Session session)
   {
       if (_activeSessions.ContainsKey(session.Id))
       {
           _repository.SaveSession(session);
       }
   }
   ```

3. **Frontend (Lobby.cshtml or component)**
   ```javascript
   lobbyHub.on('SessionNameChanged', (newName) => {
       sessionName.value = newName;
   });
   ```

### Task 3: Add session filtering by criteria

**Files to modify:**

1. **[SessionService.cs](../../DndSessionManager.Web/Services/SessionService.cs)**
   ```csharp
   public IEnumerable<Session> GetFilteredSessions(bool? isOpen = null, int? maxPlayers = null)
   {
       var sessions = GetAllSessionsForBrowse();

       if (isOpen.HasValue)
           sessions = sessions.Where(s => s.IsOpen == isOpen.Value);

       if (maxPlayers.HasValue)
           sessions = sessions.Where(s => s.MaxPlayers <= maxPlayers.Value);

       return sessions;
   }
   ```

2. **[SessionController.cs](../../DndSessionManager.Web/Controllers/SessionController.cs)**
   ```csharp
   public IActionResult Browse(bool? isOpen, int? maxPlayers)
   {
       var sessions = _sessionService.GetFilteredSessions(isOpen, maxPlayers);
       return View(sessions);
   }
   ```

3. **[Browse.cshtml](../../DndSessionManager.Web/Views/Session/Browse.cshtml)**
   ```html
   <!-- Add filters -->
   <form method="get">
       <label>Open Only: <input type="checkbox" name="isOpen" /></label>
       <label>Max Players: <input type="number" name="maxPlayers" /></label>
       <button type="submit">Filter</button>
   </form>
   ```

---

## Module Dependencies

### Dependencies on other modules:
- **Character System** → SessionService uses CharacterService in session context
- **Real-time Communication** → HubCallerService for push notifications
- **Data Layer** → ISessionRepository for persistence

### Used by:
- **Frontend UI** → All lobby components depend on session state
- **Character System** → Characters are bound to sessionId
