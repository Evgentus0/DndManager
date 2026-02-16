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
	private readonly ILiteCollection<TokenPositionHistory> _tokenPositions;
	private readonly ILiteCollection<PersistedToken> _persistedTokens;

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
		_tokenPositions = _database.GetCollection<TokenPositionHistory>("token_positions");
		_persistedTokens = _database.GetCollection<PersistedToken>("persisted_tokens");

		// Create indexes
		_sessions.EnsureIndex(x => x.State);
		_chatMessages.EnsureIndex(x => x.SessionId);
		_characters.EnsureIndex(x => x.SessionId);
		_battleMaps.EnsureIndex(x => x.SessionId);
		_tokenPositions.EnsureIndex(x => x.SessionId);
		_tokenPositions.EnsureIndex(x => x.MapId);
		_persistedTokens.EnsureIndex(x => x.SessionId);
		_persistedTokens.EnsureIndex(x => x.CharacterId);
		_persistedTokens.EnsureIndex("SessionIdCharacterId", "$.SessionId + '_' + $.CharacterId", true);
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

		// Delete associated battle maps (multiple maps per session now)
		var battleMaps = _battleMaps.Find(m => m.SessionId == sessionId);
		foreach (var map in battleMaps)
		{
			_battleMaps.Delete(map.Id);
		}

		// Delete associated token position history
		_tokenPositions.DeleteMany(tp => tp.SessionId == sessionId);

		// Delete associated persisted tokens
		_persistedTokens.DeleteMany(pt => pt.SessionId == sessionId);
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

	// Multi-map support
	public IEnumerable<BattleMap> GetBattleMaps(Guid sessionId)
	{
		return _battleMaps.Find(m => m.SessionId == sessionId)
			.OrderBy(m => m.DisplayOrder)
			.ThenBy(m => m.CreatedAt);
	}

	public BattleMap? GetActiveBattleMap(Guid sessionId)
	{
		return _battleMaps.FindOne(m => m.SessionId == sessionId && m.IsActive);
	}

	public void SetActiveMap(Guid sessionId, Guid newActiveMapId)
	{
		// Deactivate all maps for this session
		var maps = _battleMaps.Find(m => m.SessionId == sessionId);
		foreach (var map in maps)
		{
			map.IsActive = (map.Id == newActiveMapId);
			_battleMaps.Update(map);
		}
	}

	// Token position history
	public TokenPositionHistory? GetTokenPositionForMap(Guid sessionId, Guid mapId, Guid? characterId, Guid? userId)
	{
		// Priority: CharacterId first
		if (characterId.HasValue)
		{
			var byCharacter = _tokenPositions.FindOne(tp =>
				tp.SessionId == sessionId &&
				tp.MapId == mapId &&
				tp.CharacterId == characterId.Value);

			if (byCharacter != null)
				return byCharacter;
		}

		// Fallback: UserId for backward compatibility
		if (userId.HasValue)
		{
			return _tokenPositions.FindOne(tp =>
				tp.SessionId == sessionId &&
				tp.MapId == mapId &&
				tp.UserId == userId.Value);
		}

		return null;
	}

	public void SaveTokenPosition(TokenPositionHistory position)
	{
		position.UpdatedAt = DateTime.UtcNow;
		_tokenPositions.Upsert(position);
	}

	public void DeleteTokenPositionsForMap(Guid mapId)
	{
		_tokenPositions.DeleteMany(tp => tp.MapId == mapId);
	}

	// Persisted token operations
	public PersistedToken? GetPersistedToken(Guid sessionId, Guid characterId)
	{
		return _persistedTokens.FindOne(pt => pt.SessionId == sessionId && pt.CharacterId == characterId);
	}

	public IEnumerable<PersistedToken> GetSessionPersistedTokens(Guid sessionId)
	{
		return _persistedTokens.Find(pt => pt.SessionId == sessionId);
	}

	public void SavePersistedToken(PersistedToken token)
	{
		token.UpdatedAt = DateTime.UtcNow;
		_persistedTokens.Upsert(token);
	}

	public void DeletePersistedToken(Guid tokenId)
	{
		_persistedTokens.Delete(tokenId);
	}

	public void DeletePersistedTokensByCharacter(Guid characterId)
	{
		_persistedTokens.DeleteMany(pt => pt.CharacterId == characterId);
	}

	public void Dispose()
	{
		_database?.Dispose();
	}
}
