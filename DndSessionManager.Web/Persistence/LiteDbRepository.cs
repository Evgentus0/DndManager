using DndSessionManager.Web.Models;
using LiteDB;

namespace DndSessionManager.Web.Persistence;

public class LiteDbRepository : ISessionRepository, IDisposable
{
	private readonly LiteDatabase _database;
	private readonly ILiteCollection<Session> _sessions;
	private readonly ILiteCollection<ChatMessage> _chatMessages;
	private readonly ILiteCollection<Character> _characters;
	private readonly ILiteCollection<BattleMap> _battleMaps;

	public LiteDbRepository(IWebHostEnvironment env)
	{
		var dbPath = Path.Combine(env.ContentRootPath, "Data", "db", "dndmanager.db");

		// Ensure Data directory exists
		var dataDir = Path.GetDirectoryName(dbPath);
		if (!string.IsNullOrEmpty(dataDir) && !Directory.Exists(dataDir))
		{
			Directory.CreateDirectory(dataDir);
		}

		_database = new LiteDatabase(dbPath);

		_sessions = _database.GetCollection<Session>("sessions");
		_chatMessages = _database.GetCollection<ChatMessage>("chat_messages");
		_characters = _database.GetCollection<Character>("characters");
		_battleMaps = _database.GetCollection<BattleMap>("battle_maps");

		// Create indexes
		_sessions.EnsureIndex(x => x.State);
		_chatMessages.EnsureIndex(x => x.SessionId);
		_characters.EnsureIndex(x => x.SessionId);
		_battleMaps.EnsureIndex(x => x.SessionId);
	}

	// Session operations
	public Session? GetSession(Guid sessionId)
	{
		return _sessions.FindById(sessionId);
	}

	public IEnumerable<Session> GetAllSessions()
	{
		return _sessions.FindAll();
	}

	public IEnumerable<Session> GetSavedSessions()
	{
		return _sessions.Find(s => s.State == SessionState.Saved);
	}

	public void SaveSession(Session session)
	{
		_sessions.Upsert(session);
	}

	public void DeleteSession(Guid sessionId)
	{
		_sessions.Delete(sessionId);
		DeleteChatMessages(sessionId);

		// Delete associated characters
		var characters = _characters.Find(c => c.SessionId == sessionId);
		foreach (var character in characters)
		{
			_characters.Delete(character.Id);
		}

		// Delete associated battle map
		var battleMap = _battleMaps.FindOne(m => m.SessionId == sessionId);
		if (battleMap != null)
		{
			_battleMaps.Delete(battleMap.Id);
		}
	}

	// Chat message operations
	public IEnumerable<ChatMessage> GetChatMessages(Guid sessionId)
	{
		return _chatMessages.Find(m => m.SessionId == sessionId).OrderBy(m => m.Timestamp);
	}

	public void SaveChatMessages(Guid sessionId, IEnumerable<ChatMessage> messages)
	{
		// Delete existing messages for this session first
		DeleteChatMessages(sessionId);

		// Insert new messages
		_chatMessages.InsertBulk(messages);
	}

	public void DeleteChatMessages(Guid sessionId)
	{
		_chatMessages.DeleteMany(m => m.SessionId == sessionId);
	}

	// Character operations
	public IEnumerable<Character> GetSessionCharacters(Guid sessionId)
	{
		return _characters.Find(c => c.SessionId == sessionId);
	}

	public Character? GetCharacter(Guid characterId)
	{
		return _characters.FindById(characterId);
	}

	public void SaveCharacter(Character character)
	{
		_characters.Upsert(character);
	}

	public void DeleteCharacter(Guid characterId)
	{
		_characters.Delete(characterId);
	}

	public void SetSaveForAllSessions()
	{
		_ = _sessions.UpdateMany(s => new Session { State = SessionState.Saved },
			s => s.State != SessionState.Saved);
	}

	// Battle map operations
	public BattleMap? GetBattleMap(Guid mapId)
	{
		return _battleMaps.FindById(mapId);
	}

	public BattleMap? GetBattleMapBySession(Guid sessionId)
	{
		return _battleMaps.FindOne(m => m.SessionId == sessionId);
	}

	public void SaveBattleMap(BattleMap map)
	{
		map.UpdatedAt = DateTime.UtcNow;
		_battleMaps.Upsert(map);
	}

	public void DeleteBattleMap(Guid mapId)
	{
		_battleMaps.Delete(mapId);
	}

	public void Dispose()
	{
		_database?.Dispose();
	}
}
