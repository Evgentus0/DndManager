using System.Collections.Concurrent;
using DndSessionManager.Web.Models;

namespace DndSessionManager.Web.Services;

public class SessionService
{
    private readonly ConcurrentDictionary<Guid, Session> _sessions = new();
    private readonly ConcurrentDictionary<Guid, List<ChatMessage>> _chatMessages = new();

    public Session CreateSession(string name, string password, int maxPlayers, string? description, Guid masterId)
    {
        var session = new Session
        {
            Name = name,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            MaxPlayers = maxPlayers,
            Description = description,
            MasterId = masterId
        };

        _sessions.TryAdd(session.Id, session);
        _chatMessages.TryAdd(session.Id, new List<ChatMessage>());

        return session;
    }

    public Session? GetSession(Guid sessionId)
    {
        _sessions.TryGetValue(sessionId, out var session);
        return session;
    }

    public IEnumerable<Session> GetAllSessions()
    {
        return _sessions.Values.Where(s => s.IsOpen);
    }

    public bool DeleteSession(Guid sessionId)
    {
        var removed = _sessions.TryRemove(sessionId, out _);
        if (removed)
        {
            _chatMessages.TryRemove(sessionId, out _);
        }
        return removed;
    }

    public bool AddUserToSession(Guid sessionId, User user)
    {
        if (!_sessions.TryGetValue(sessionId, out var session))
            return false;

        if (!session.IsOpen || session.Users.Count >= session.MaxPlayers)
            return false;

        session.Users.Add(user);
        return true;
    }

    public bool RemoveUserFromSession(Guid sessionId, Guid userId)
    {
        if (!_sessions.TryGetValue(sessionId, out var session))
            return false;

        var user = session.Users.FirstOrDefault(u => u.Id == userId);
        if (user == null)
            return false;

        session.Users.Remove(user);

        // If the master leaves, delete the session
        if (user.Id == session.MasterId)
        {
            DeleteSession(sessionId);
        }

        return true;
    }

    public bool ValidatePassword(Guid sessionId, string password)
    {
        if (!_sessions.TryGetValue(sessionId, out var session))
            return false;

        return BCrypt.Net.BCrypt.Verify(password, session.PasswordHash);
    }

    public void AddChatMessage(ChatMessage message)
    {
        if (_chatMessages.TryGetValue(message.SessionId, out var messages))
        {
            messages.Add(message);
        }
    }

    public IEnumerable<ChatMessage> GetChatMessages(Guid sessionId)
    {
        if (_chatMessages.TryGetValue(sessionId, out var messages))
        {
            return messages.OrderBy(m => m.Timestamp);
        }
        return Enumerable.Empty<ChatMessage>();
    }

    public void UpdateSessionOpen(Guid sessionId, bool isOpen)
    {
        if (_sessions.TryGetValue(sessionId, out var session))
        {
            session.IsOpen = isOpen;
        }
    }
}
