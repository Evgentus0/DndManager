using Microsoft.AspNetCore.SignalR;
using DndSessionManager.Web.Models;
using DndSessionManager.Web.Services;

namespace DndSessionManager.Web.Hubs;

public class LobbyHub : Hub
{
    private readonly SessionService _sessionService;
    private readonly UserService _userService;

    public LobbyHub(SessionService sessionService, UserService userService)
    {
        _sessionService = sessionService;
        _userService = userService;
    }

    public async Task JoinLobby(string sessionId, string userId)
    {
        if (!Guid.TryParse(sessionId, out var sessionGuid) || !Guid.TryParse(userId, out var userGuid))
            return;

        var session = _sessionService.GetSession(sessionGuid);
        if (session == null)
            return;

        // Update connection ID
        _userService.UpdateConnectionId(sessionGuid, userGuid, Context.ConnectionId);

        // Join SignalR group for this session
        await Groups.AddToGroupAsync(Context.ConnectionId, sessionId);

        var user = _userService.GetUser(sessionGuid, userGuid);
        if (user != null)
        {
            // Notify others that user joined
            await Clients.Group(sessionId).SendAsync("UserJoined", new
            {
                user.Id,
                user.Username,
                Role = user.Role.ToString()
            });

            // Send current user list to the new user
            var users = session.Users.Select(u => new
            {
                u.Id,
                u.Username,
                Role = u.Role.ToString()
            });
            await Clients.Caller.SendAsync("InitialUserList", users);

            // Send chat history to the new user
            var messages = _sessionService.GetChatMessages(sessionGuid);
            await Clients.Caller.SendAsync("ChatHistory", messages.Select(m => new
            {
                m.Username,
                m.Message,
                m.Timestamp
            }));
        }
    }

    public async Task LeaveLobby(string sessionId, string userId)
    {
        if (!Guid.TryParse(sessionId, out var sessionGuid) || !Guid.TryParse(userId, out var userGuid))
            return;

        var user = _userService.GetUser(sessionGuid, userGuid);
        if (user != null)
        {
            await Clients.Group(sessionId).SendAsync("UserLeft", new
            {
                user.Id,
                user.Username
            });
        }

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, sessionId);
    }

    public async Task SendMessage(string sessionId, string userId, string message)
    {
        if (!Guid.TryParse(sessionId, out var sessionGuid) || !Guid.TryParse(userId, out var userGuid))
            return;

        if (string.IsNullOrWhiteSpace(message))
            return;

        var user = _userService.GetUser(sessionGuid, userGuid);
        if (user != null)
        {
            var chatMessage = new ChatMessage
            {
                SessionId = sessionGuid,
                Username = user.Username,
                Message = message.Trim()
            };

            _sessionService.AddChatMessage(chatMessage);

            await Clients.Group(sessionId).SendAsync("ReceiveMessage", new
            {
                chatMessage.Username,
                chatMessage.Message,
                chatMessage.Timestamp
            });
        }
    }

    public async Task KickUser(string sessionId, string masterUserId, string targetUserId)
    {
        if (!Guid.TryParse(sessionId, out var sessionGuid) ||
            !Guid.TryParse(masterUserId, out var masterUserGuid) ||
            !Guid.TryParse(targetUserId, out var targetUserGuid))
            return;

        // Verify the requester is the master
        if (!_userService.IsUserMaster(sessionGuid, masterUserGuid))
            return;

        var targetUser = _userService.GetUser(sessionGuid, targetUserGuid);
        if (targetUser != null && targetUser.Role != UserRole.Master)
        {
            // Notify the kicked user
            if (!string.IsNullOrEmpty(targetUser.ConnectionId))
            {
                await Clients.Client(targetUser.ConnectionId).SendAsync("UserKicked");
            }

            // Remove user from session
            _sessionService.RemoveUserFromSession(sessionGuid, targetUserGuid);

            // Notify others
            await Clients.Group(sessionId).SendAsync("UserLeft", new
            {
                targetUser.Id,
                targetUser.Username
            });
        }
    }

    public async Task ToggleSessionOpen(string sessionId, string masterUserId, bool isOpen)
    {
        if (!Guid.TryParse(sessionId, out var sessionGuid) ||
            !Guid.TryParse(masterUserId, out var masterUserGuid))
            return;

        // Verify the requester is the master
        if (!_userService.IsUserMaster(sessionGuid, masterUserGuid))
            return;

        _sessionService.UpdateSessionOpen(sessionGuid, isOpen);

        await Clients.Group(sessionId).SendAsync("SessionOpenChanged", isOpen);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        // Find user by connection ID and notify others
        var sessions = _sessionService.GetAllSessions();
        foreach (var session in sessions)
        {
            var user = session.Users.FirstOrDefault(u => u.ConnectionId == Context.ConnectionId);
            if (user != null)
            {
                await Clients.Group(session.Id.ToString()).SendAsync("UserDisconnected", new
                {
                    user.Id,
                    user.Username
                });
                break;
            }
        }

        await base.OnDisconnectedAsync(exception);
    }
}
