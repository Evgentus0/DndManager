using System.Collections.Concurrent;
using DndSessionManager.Web.Data;
using DndSessionManager.Web.Models;

namespace DndSessionManager.Web.Services;

public class SessionService
{
	private static readonly ConcurrentDictionary<Guid, Session> _activeSessions = new();
	private static readonly ConcurrentDictionary<Guid, List<ChatMessage>> _chatMessages = new();
	private readonly ISessionRepository _repository;
	private readonly IHubCallerService _hubCaller;

	public SessionService(ISessionRepository repository, IHubCallerService hubCaller)
	{
		_repository = repository;
		_hubCaller = hubCaller;
	}

	public Session CreateSession(string name, string joinPassword, string masterPassword, int maxPlayers, string? description, Guid masterId, string masterUsername)
	{
		var session = new Session
		{
			Name = name,
			PasswordHash = BCrypt.Net.BCrypt.HashPassword(joinPassword),
			MasterPasswordHash = BCrypt.Net.BCrypt.HashPassword(masterPassword),
			MaxPlayers = maxPlayers,
			Description = description,
			MasterId = masterId,
			MasterUsername = masterUsername,
			State = SessionState.Active,
			LastPlayedAt = DateTime.UtcNow
		};

		_activeSessions.TryAdd(session.Id, session);
		_chatMessages.TryAdd(session.Id, []);

		// Persist to database
		_repository.SaveSession(session);

		RefreshBrowseSessions();

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
		var savedSessions = _repository.GetSavedSessions().ToList();

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
		RefreshBrowseSessions();

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
			RefreshBrowseSessions();
		}
	}

	public bool DeleteSession(Guid sessionId)
	{
		var removed = _activeSessions.TryRemove(sessionId, out _);
		if (removed)
		{
			_chatMessages.TryRemove(sessionId, out _);
			RefreshBrowseSessions();
		}
		return removed;
	}

	public bool DeleteSavedSession(Guid sessionId)
	{
		var session = _repository.GetSession(sessionId);
		if (session == null)
			return false;

		_repository.DeleteSession(sessionId);
		RefreshBrowseSessions();
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

	public bool ValidateMasterPassword(Guid sessionId, string password)
	{
		Session? session = null;

		// First check active sessions
		if (_activeSessions.TryGetValue(sessionId, out var activeSession))
		{
			session = activeSession;
		}
		else
		{
			// Then check saved sessions in DB
			session = _repository.GetSession(sessionId);
		}

		if (session == null)
			return false;

		// If MasterPasswordHash is not set (old sessions), fall back to PasswordHash
		var hashToVerify = session.MasterPasswordHash ?? session.PasswordHash;
		return BCrypt.Net.BCrypt.Verify(password, hashToVerify);
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
			FinishSessionOnMasterLeave(sessionId);
		}
		else
		{
			ForceUserLeft(sessionId, user);
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
		return [];
	}

	public void UpdateSessionOpen(Guid sessionId, bool isOpen)
	{
		if (_activeSessions.TryGetValue(sessionId, out var session))
		{
			session.IsOpen = isOpen;
			RefreshBrowseSessions();
		}
	}

	public void UpdateSessionNotes(Guid sessionId, string notes)
	{
		if (_activeSessions.TryGetValue(sessionId, out var session))
		{
			session.MasterNotes = notes;
			_repository.SaveSession(session);
		}
	}

	public void ShutdownAllSessions()
	{
		var activeSessionIds = _activeSessions.Keys.ToList();
		foreach (var sessionId in activeSessionIds)
		{
			SaveAndDeactivateSession(sessionId);
		}

		_repository.SetSaveForAllSessions();
	}

	private void FinishSessionOnMasterLeave(Guid sessionId)
	{
		_ = _hubCaller.LobbyMasterLeave(sessionId.ToString());
	}

	private void RefreshBrowseSessions()
	{
		_ = _hubCaller.BrowseRefreshAvailableSessionsList(GetAllSessionsForBrowse());
	}

	private void ForceUserLeft(Guid sessionId, User user)
	{
		_ = _hubCaller.LobbyUserLeft(sessionId.ToString(), user);
	}
}
