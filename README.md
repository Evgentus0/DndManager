# D&D Session Manager

A .NET application for managing Dungeons & Dragons sessions with a WPF host and full-featured web interface.

## Project Structure

The solution consists of two projects:

1. **DndSessionManager.Host** - WPF application (.NET 8.0) that hosts the web server
2. **DndSessionManager.Web** - ASP.NET Core Web App (.NET 8.0) with the game session interface

## Features

### Host Application (WPF)
- Simple Windows application to start/stop the web server
- Displays server status and access URL
- Shows the local IP address for network access
- Minimal, functional UI

### Web Application
- **Session Creation**: Game Masters can create new sessions with password protection
- **Session Browser**: Players can browse and join available sessions
- **Lobby/Waiting Room**: Real-time chat and ready status for all participants
- **Master Controls**: Kick players, close session to new players, start game
- **Real-time Updates**: SignalR-powered live updates for all lobby interactions
- **Mobile-Friendly**: Responsive Bootstrap 5 design

## How to Run

### Option 1: Run the WPF Host (Recommended)

1. Open the solution in Visual Studio 2022 or later
2. Set `DndSessionManager.Host` as the startup project
3. Press F5 to run
4. Click "Start Server" in the WPF window
5. Note the URL displayed (e.g., `http://192.168.1.100:5000`)
6. Share this URL with players on your network

### Option 2: Run the Web App Directly

```bash
cd DndSessionManager.Web
dotnet run
```

Then navigate to `http://localhost:5000` in your browser.

## Usage Guide

### For Game Masters (Hosting a Session)

1. **Start the Server**: Run the WPF host application and click "Start Server"
2. **Create Session**:
   - Open the displayed URL in your browser
   - Click "Host Session"
   - Enter session name, password, and max players
   - Click "Create Session"
3. **Wait in Lobby**:
   - You'll be taken to the lobby as the Game Master
   - Wait for players to join
   - Use the chat to communicate
   - Toggle "Open to New Players" to control access
   - Kick players if needed
   - Click "Start Session" when all players are ready

### For Players (Joining a Session)

1. **Get URL**: Ask the Game Master for the server URL (e.g., `http://192.168.1.100:5000`)
2. **Browse Sessions**:
   - Open the URL in your browser
   - Click "Join Session"
   - Select a session from the list
3. **Join Session**:
   - Enter your username
   - Enter the session password (ask Game Master if you don't have it)
   - Click "Join Session"
4. **Wait in Lobby**:
   - Use the chat to communicate with other players
   - Check "I'm Ready" when you're ready to start
   - Wait for the Game Master to start the session

## Technical Details

### Architecture

- **Backend**: ASP.NET Core MVC (.NET 8.0)
- **Frontend**: Razor Views with Bootstrap 5
- **Real-time Communication**: SignalR
- **Password Security**: BCrypt.Net-Next for password hashing
- **Session Storage**: In-memory (ConcurrentDictionary)
- **Server**: Kestrel listening on all network interfaces (port 5000)

### Key Components

#### Models
- `Session`: Represents a game session with players, settings, and metadata
- `User`: Represents a participant (Game Master or Player)
- `ChatMessage`: Represents a chat message in the lobby
- `UserRole`: Enum for Master/Player roles

#### Services
- `SessionService`: Manages session lifecycle and storage
- `UserService`: Manages user operations and status

#### SignalR Hub
- `LobbyHub`: Handles real-time lobby interactions
  - User join/leave events
  - Ready status updates
  - Chat messages
  - Master actions (kick, start session)

### Network Configuration

The application listens on `http://0.0.0.0:5000`, making it accessible:
- Locally at `http://localhost:5000`
- On your network at `http://[your-ip]:5000`

**Note**: Make sure port 5000 is not blocked by your firewall.

## Testing Steps

1. Run the WPF host application
2. Click "Start Server"
3. Note the displayed URL
4. **Same Device Test**:
   - Open browser, navigate to the URL
   - Create a session
5. **Network Test**:
   - Open browser on another device (phone, tablet, another PC)
   - Navigate to the same URL
   - Join the created session
6. **Functionality Test**:
   - Test chat messages
   - Toggle ready status
   - Test master controls (kick, close to new players)
   - Verify real-time updates work across all devices

## Mobile Support

The web interface is fully responsive and mobile-friendly:
- Touch-friendly buttons and controls
- Optimized layout for small screens
- Works on iOS and Android browsers
- Tested on phones and tablets

## Limitations

- Sessions are stored in memory only (lost on server restart)
- No persistent data storage
- Basic authentication (password only, no user accounts)
- Single server instance (no load balancing)
- HTTP only (no HTTPS by default for local network ease)

## Future Enhancements

Potential improvements:
- Persistent storage (database)
- User accounts and authentication
- Session history
- Dice rolling integration
- Character sheet management
- Map and asset sharing
- Voice/video integration
- HTTPS support

## Requirements

- .NET 8.0 SDK or later
- Windows (for WPF host) or any OS (for web app only)
- Modern web browser (Chrome, Firefox, Safari, Edge)

## License

This project is provided as-is for educational and personal use.
