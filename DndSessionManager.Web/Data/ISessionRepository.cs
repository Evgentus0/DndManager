using DndSessionManager.Web.Models;

namespace DndSessionManager.Web.Data;

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
}
