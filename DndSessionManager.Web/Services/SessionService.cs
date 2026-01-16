using System.Collections.Concurrent;
using DndSessionManager.Web.Data;
using DndSessionManager.Web.Models;

namespace DndSessionManager.Web.Services;

public class SessionService
{
    private readonly ConcurrentDictionary<Guid, Session> _activeSessions = new();
    private readonly ConcurrentDictionary<Guid, List<ChatMessage>> _chatMessages = new();
    private readonly ISessionRepository _repository;

    public SessionService(ISessionRepository repository)
    {
        _repository = repository;
    }

    public Session CreateSession(string name, string password, int maxPlayers, string? description, Guid masterId, string masterUsername)
    {
        var session = new Session
        {
            Name = name,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            MaxPlayers = maxPlayers,
            Description = description,
            MasterId = masterId,
            MasterUsername = masterUsername,
            State = SessionState.Active,
            LastPlayedAt = DateTime.UtcNow
        };

        _activeSessions.TryAdd(session.Id, session);
        _chatMessages.TryAdd(session.Id, new List<ChatMessage>());

        // Persist to database
        _repository.SaveSession(session);

        return session;
    }

    public Session? GetSession(Guid sessionId)
    {
        _activeSessions.TryGetValue(sessionId, out var session);
        return session;
    }

    public Session? GetSessionFromDb(Guid sessionId)
    {
        return _repository.GetSession(sessionId);
    }

    public IEnumerable<Session> GetActiveSessions()
    {
        return _activeSessions.Values.Where(s => s.IsOpen);
    }

    public IEnumerable<Session> GetAllSessions()
    {
        return _activeSessions.Values;
    }

    public IEnumerable<Session> GetSavedSessions()
    {
        return _repository.GetSavedSessions();
    }

    public IEnumerable<Session> GetAllSessionsForBrowse()
    {
        // Combine active open sessions and saved sessions
        var activeSessions = _activeSessions.Values.Where(s => s.IsOpen);
        var savedSessions = _repository.GetSavedSessions();

        return activeSessions.Concat(savedSessions).OrderByDescending(s => s.LastPlayedAt ?? s.CreatedAt);
    }

    public Session? ResumeSession(Guid sessionId)
    {
        var saved = _repository.GetSession(sessionId);
        if (saved == null || saved.State != SessionState.Saved)
            return null;

        saved.State = SessionState.Active;
        saved.IsOpen = true;
        saved.LastPlayedAt = DateTime.UtcNow;
        saved.Users.Clear();

        _activeSessions.TryAdd(saved.Id, saved);

        // Load chat history
        var messages = _repository.GetChatMessages(sessionId).ToList();
        _chatMessages.TryAdd(sessionId, messages);

        // Update state in DB
        _repository.SaveSession(saved);

        return saved;
    }

    public void SaveAndDeactivateSession(Guid sessionId)
    {
        if (_activeSessions.TryRemove(sessionId, out var session))
        {
            session.State = SessionState.Saved;
            session.LastSavedAt = DateTime.UtcNow;
            session.IsOpen = false;

            _repository.SaveSession(session);

            // Save chat messages
            if (_chatMessages.TryRemove(sessionId, out var messages))
            {
                _repository.SaveChatMessages(sessionId, messages);
            }
        }
    }

    public bool DeleteSession(Guid sessionId)
    {
        var removed = _activeSessions.TryRemove(sessionId, out _);
        if (removed)
        {
            _chatMessages.TryRemove(sessionId, out _);
        }
        return removed;
    }

    public bool DeleteSavedSession(Guid sessionId)
    {
        var session = _repository.GetSession(sessionId);
        if (session == null)
            return false;

        _repository.DeleteSession(sessionId);
        return true;
    }

    public bool ValidateSessionPassword(Guid sessionId, string password)
    {
        // First check active sessions
        if (_activeSessions.TryGetValue(sessionId, out var activeSession))
        {
            return BCrypt.Net.BCrypt.Verify(password, activeSession.PasswordHash);
        }

        // Then check saved sessions in DB
        var savedSession = _repository.GetSession(sessionId);
        if (savedSession != null)
        {
            return BCrypt.Net.BCrypt.Verify(password, savedSession.PasswordHash);
        }

        return false;
    }

    public bool AddUserToSession(Guid sessionId, User user)
    {
        if (!_activeSessions.TryGetValue(sessionId, out var session))
            return false;

        if (!session.IsOpen || session.Users.Count >= session.MaxPlayers)
            return false;

        session.Users.Add(user);
        return true;
    }

    public bool RemoveUserFromSession(Guid sessionId, Guid userId)
    {
        if (!_activeSessions.TryGetValue(sessionId, out var session))
            return false;

        var user = session.Users.FirstOrDefault(u => u.Id == userId);
        if (user == null)
            return false;

        session.Users.Remove(user);

        // If the master leaves, save the session instead of deleting
        if (user.Id == session.MasterId)
        {
            SaveAndDeactivateSession(sessionId);
        }

        return true;
    }

    public bool ValidatePassword(Guid sessionId, string password)
    {
        if (!_activeSessions.TryGetValue(sessionId, out var session))
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
        if (_activeSessions.TryGetValue(sessionId, out var session))
        {
            session.IsOpen = isOpen;
        }
    }
}
