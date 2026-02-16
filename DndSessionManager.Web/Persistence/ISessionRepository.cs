using DndSessionManager.Web.Models;

namespace DndSessionManager.Web.Persistence;

public interface ISessionRepository
{
    // Session operations
    Session? GetSession(Guid sessionId);
    IEnumerable<Session> GetAllSessions();
    IEnumerable<Session> GetSavedSessions();
    void SaveSession(Session session);
    void DeleteSession(Guid sessionId);

    // Chat message operations
    IEnumerable<ChatMessage> GetChatMessages(Guid sessionId);
    void SaveChatMessages(Guid sessionId, IEnumerable<ChatMessage> messages);
    void DeleteChatMessages(Guid sessionId);

    // Character operations (stubs for future)
    IEnumerable<Character> GetSessionCharacters(Guid sessionId);
    Character? GetCharacter(Guid characterId);
    void SaveCharacter(Character character);
    void DeleteCharacter(Guid characterId);
	void SetSaveForAllSessions();

	// Battle map operations
	BattleMap? GetBattleMap(Guid mapId);
	BattleMap? GetBattleMapBySession(Guid sessionId);
	void SaveBattleMap(BattleMap map);
	void DeleteBattleMap(Guid mapId);

	// Multi-map support
	IEnumerable<BattleMap> GetBattleMaps(Guid sessionId);
	BattleMap? GetActiveBattleMap(Guid sessionId);
	void SetActiveMap(Guid sessionId, Guid newActiveMapId);

	// Token position history
	TokenPositionHistory? GetTokenPositionForMap(Guid sessionId, Guid mapId, Guid? characterId, Guid? userId);
	void SaveTokenPosition(TokenPositionHistory position);
	void DeleteTokenPositionsForMap(Guid mapId);

	// Persisted token operations
	PersistedToken? GetPersistedToken(Guid sessionId, Guid characterId);
	IEnumerable<PersistedToken> GetSessionPersistedTokens(Guid sessionId);
	void SavePersistedToken(PersistedToken token);
	void DeletePersistedToken(Guid tokenId);
	void DeletePersistedTokensByCharacter(Guid characterId);
}
