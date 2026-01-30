# Module: Real-time Communication

## Purpose

The Real-time Communication module handles all WebSocket-based real-time features using SignalR:
- Session-scoped broadcasts (all users in a session receive updates)
- User connection management (tracking who's online)
- Chat messages
- Session list updates (Browse page)
- Character updates
- Master notes synchronization

---

## Key Files

### SignalR Hubs

| File | Role | Main Methods |
|------|------|--------------|
| [LobbyHub.cs](../../DndSessionManager.Web/Hubs/LobbyHub.cs) | Main hub for game sessions | `JoinLobby`, `LeaveLobby`, `SendMessage`, `CreateCharacter`, `UpdateCharacter`, `ToggleSessionOpen` |
| [BrowseHub.cs](../../DndSessionManager.Web/Hubs/BrowseHub.cs) | Hub for browse page updates | (empty - used only for broadcasts) |

### Services

| File | Role | Main Methods |
|------|------|-------------|
| [HubCallerService.cs](../../DndSessionManager.Web/Services/HubCallerService.cs) | Service layer for SignalR calls | `BrowseRefreshAvailableSessionsList`, `SendToGroup`, `SendToUser` |

---

## SignalR Architecture

### Groups

SignalR groups are used for session-scoped broadcasts:
- **Session Group:** `sessionId` - All users in the same session
- **Browse Group:** `"browse"` - All users on the Browse page

### Connection Lifecycle

```
User connects to SignalR
    → Hub.OnConnectedAsync()
    → Store connectionId

User joins lobby
    → LobbyHub.JoinLobby(sessionId, userId)
    → Groups.AddToGroupAsync(Context.ConnectionId, sessionId)
    → UserService.UpdateConnectionId(sessionId, userId, connectionId)

User leaves lobby
    → LobbyHub.LeaveLobby(sessionId, userId)
    → Groups.RemoveFromGroupAsync(Context.ConnectionId, sessionId)

User disconnects
    → Hub.OnDisconnectedAsync()
    → Clean up user from session
```

---

## LobbyHub Events

### Client → Server (Invoke)

| Method | Parameters | Description |
|--------|-----------|-------------|
| `JoinLobby` | `sessionId`, `userId` | Join session group |
| `LeaveLobby` | `sessionId`, `userId` | Leave session group |
| `SendMessage` | `sessionId`, `userId`, `message` | Send chat message |
| `KickUser` | `sessionId`, `masterUserId`, `targetUserId` | Master kicks a player |
| `ToggleSessionOpen` | `sessionId`, `masterUserId`, `isOpen` | Toggle session open/closed |
| `SaveMasterNotes` | `sessionId`, `masterUserId`, `notes` | Save master's notes |
| `LoadMasterNotes` | `sessionId`, `masterUserId` | Load master's notes |
| `CreateCharacter` | `sessionId`, `userId`, `characterData`, `password` | Create a character |
| `UpdateCharacter` | `sessionId`, `userId`, `characterId`, `characterData`, `password` | Update a character |
| `DeleteCharacter` | `sessionId`, `userId`, `characterId`, `password` | Delete a character |
| `SelectCharacter` | `sessionId`, `userId`, `characterId`, `password` | Select character for play |

### Server → Client (Broadcast)

| Event | Payload | Description |
|-------|---------|-------------|
| `ReceiveMessage` | `{ username, message, timestamp }` | New chat message |
| `UserJoined` | `User` | User joined session |
| `UserLeft` | `userId` | User left session |
| `UserKicked` | `userId` | User was kicked |
| `SessionOpenChanged` | `isOpen` | Session open/closed state changed |
| `MasterNotesLoaded` | `notes` | Master notes loaded |
| `CharacterCreated` | `Character` | New character created |
| `CharacterUpdated` | `Character` | Character updated |
| `CharacterDeleted` | `characterId` | Character deleted |
| `UserCharacterSelected` | `userId`, `Character` | User selected a character |

---

## BrowseHub Events

### Server → Client (Broadcast)

| Event | Payload | Description |
|-------|---------|-------------|
| `RefreshAvailableSessionsList` | (none) | Trigger client to refresh session list |

---

## HubCallerService

Service layer wrapper for SignalR calls from non-hub code:

```csharp
public class HubCallerService
{
    private readonly IHubContext<LobbyHub> _lobbyHubContext;
    private readonly IHubContext<BrowseHub> _browseHubContext;

    // Broadcast to Browse page
    public async Task BrowseRefreshAvailableSessionsList()
    {
        await _browseHubContext.Clients.All.SendAsync("RefreshAvailableSessionsList");
    }

    // Broadcast to specific session group
    public async Task SendToGroup(string sessionId, string eventName, object data)
    {
        await _lobbyHubContext.Clients.Group(sessionId).SendAsync(eventName, data);
    }

    // Send to specific user
    public async Task SendToUser(string connectionId, string eventName, object data)
    {
        await _lobbyHubContext.Clients.Client(connectionId).SendAsync(eventName, data);
    }
}
```

---

## Common Modification Tasks

### Task 1: Add a new real-time event (e.g., "dice rolled")

**Files to modify:**

1. **[LobbyHub.cs](../../DndSessionManager.Web/Hubs/LobbyHub.cs)**
   ```csharp
   public async Task RollDice(string sessionId, string userId, int diceType, int count)
   {
       if (!Guid.TryParse(sessionId, out var sessionGuid) ||
           !Guid.TryParse(userId, out var userGuid))
           return;

       var user = _userService.GetUser(sessionGuid, userGuid);
       if (user == null) return;

       var random = new Random();
       var results = Enumerable.Range(0, count)
           .Select(_ => random.Next(1, diceType + 1))
           .ToList();

       var total = results.Sum();

       await Clients.Group(sessionId).SendAsync("DiceRolled", new
       {
           Username = user.Username,
           DiceType = diceType,
           Count = count,
           Results = results,
           Total = total
       });
   }
   ```

2. **Frontend (LobbyChatPanel.js or new component)**
   ```javascript
   // Listen for dice roll events
   lobbyHub.on('DiceRolled', (data) => {
       console.log(`${data.Username} rolled ${data.Count}d${data.DiceType}: ${data.Results.join(', ')} = ${data.Total}`);
       // Update UI
   });

   // Roll dice
   const rollDice = async (diceType, count) => {
       await lobbyHub.invoke('RollDice', sessionId, userId, diceType, count);
   };
   ```

### Task 2: Add a private message system

**Files to modify:**

1. **[LobbyHub.cs](../../DndSessionManager.Web/Hubs/LobbyHub.cs)**
   ```csharp
   public async Task SendPrivateMessage(string sessionId, string senderId, string recipientId, string message)
   {
       if (!Guid.TryParse(sessionId, out var sessionGuid) ||
           !Guid.TryParse(senderId, out var senderGuid) ||
           !Guid.TryParse(recipientId, out var recipientGuid))
           return;

       var sender = _userService.GetUser(sessionGuid, senderGuid);
       var recipient = _userService.GetUser(sessionGuid, recipientGuid);

       if (sender == null || recipient == null || string.IsNullOrEmpty(recipient.ConnectionId))
           return;

       await Clients.Client(recipient.ConnectionId).SendAsync("ReceivePrivateMessage", new
       {
           From = sender.Username,
           Message = message,
           Timestamp = DateTime.UtcNow
       });
   }
   ```

2. **Frontend**
   ```javascript
   lobbyHub.on('ReceivePrivateMessage', (data) => {
       console.log(`Private message from ${data.From}: ${data.Message}`);
       // Show notification or update UI
   });
   ```

### Task 3: Add connection state monitoring

**Files to modify:**

1. **[LobbyHub.cs](../../DndSessionManager.Web/Hubs/LobbyHub.cs)**
   ```csharp
   public override async Task OnConnectedAsync()
   {
       await base.OnConnectedAsync();
       // Track connection
   }

   public override async Task OnDisconnectedAsync(Exception? exception)
   {
       // Find all sessions this connection was part of
       var sessions = _sessionService.GetActiveSessions();
       foreach (var session in sessions)
       {
           var user = session.Users.FirstOrDefault(u => u.ConnectionId == Context.ConnectionId);
           if (user != null)
           {
               await Groups.RemoveFromGroupAsync(Context.ConnectionId, session.Id.ToString());
               await Clients.Group(session.Id.ToString()).SendAsync("UserDisconnected", user.Id);
           }
       }

       await base.OnDisconnectedAsync(exception);
   }
   ```

2. **Frontend**
   ```javascript
   lobbyHub.on('UserDisconnected', (userId) => {
       console.log(`User ${userId} disconnected`);
       // Update UI to show user as offline
   });
   ```

---

## Best Practices

### 1. Always Validate Input
```csharp
if (!Guid.TryParse(sessionId, out var sessionGuid))
    return; // Never trust client input
```

### 2. Check Permissions
```csharp
if (!_userService.IsUserMaster(sessionGuid, userGuid))
{
    await Clients.Caller.SendAsync("Error", "Only master can perform this action");
    return;
}
```

### 3. Use Groups for Session-scoped Broadcasts
```csharp
// Good: Broadcast to specific session
await Clients.Group(sessionId).SendAsync("EventName", data);

// Bad: Broadcast to everyone
await Clients.All.SendAsync("EventName", data);
```

### 4. Handle Disconnections Gracefully
```csharp
public override async Task OnDisconnectedAsync(Exception? exception)
{
    // Clean up user state
    // Notify other users
    await base.OnDisconnectedAsync(exception);
}
```

---

## Module Dependencies

### Dependencies on other modules:
- **Session Management** → Uses SessionService, UserService
- **Character System** → CharacterService for character operations
- **Data Layer** → Repositories for persistence

### Used by:
- **Frontend UI** → All Vue components use SignalR for real-time updates
- **Session Management** → HubCallerService for broadcasts
