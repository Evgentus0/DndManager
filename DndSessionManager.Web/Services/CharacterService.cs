using DndSessionManager.Web.Data;
using DndSessionManager.Web.Models;

namespace DndSessionManager.Web.Services;

public class CharacterService
{
    private readonly ISessionRepository _repository;

    public CharacterService(ISessionRepository repository)
    {
        _repository = repository;
    }

    public IEnumerable<Character> GetSessionCharacters(Guid sessionId)
    {
        return _repository.GetSessionCharacters(sessionId);
    }

    public Character? GetCharacter(Guid characterId)
    {
        return _repository.GetCharacter(characterId);
    }

    public Character? GetCharacterByOwner(Guid sessionId, Guid ownerId)
    {
        return _repository.GetSessionCharacters(sessionId)
            .FirstOrDefault(c => c.OwnerId == ownerId);
    }

    public bool HasCharacter(Guid sessionId, Guid ownerId)
    {
        return GetCharacterByOwner(sessionId, ownerId) != null;
    }

    public Character CreateCharacter(Character character, string password)
    {
        character.Id = Guid.NewGuid();
        character.CreatedAt = DateTime.UtcNow;
        character.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password);
        _repository.SaveCharacter(character);
        return character;
    }

    public Character? UpdateCharacter(Character character)
    {
        var existing = _repository.GetCharacter(character.Id);
        if (existing == null)
            return null;

        character.UpdatedAt = DateTime.UtcNow;
        character.CreatedAt = existing.CreatedAt;
        _repository.SaveCharacter(character);
        return character;
    }

    public bool DeleteCharacter(Guid characterId)
    {
        var character = _repository.GetCharacter(characterId);
        if (character == null)
            return false;

        _repository.DeleteCharacter(characterId);
        return true;
    }

    public bool CanUserEditCharacter(Guid userId, Character character, bool isMaster)
    {
        return isMaster || character.OwnerId == userId;
    }

    public bool CanUserDeleteCharacter(Guid userId, Character character, bool isMaster)
    {
        return isMaster || character.OwnerId == userId;
    }

    public bool IsCharacterClaimed(Character character)
    {
        return !string.IsNullOrEmpty(character.PasswordHash);
    }

    public bool ValidateCharacterPassword(Guid characterId, string password)
    {
        var character = _repository.GetCharacter(characterId);
        if (character == null || string.IsNullOrEmpty(character.PasswordHash))
            return false;

        return BCrypt.Net.BCrypt.Verify(password, character.PasswordHash);
    }

    public Character? ClaimCharacter(Guid characterId, Guid newOwnerId, string newOwnerUsername, string password)
    {
        var character = _repository.GetCharacter(characterId);
        if (character == null)
            return null;

        character.OwnerId = newOwnerId;
        character.OwnerUsername = newOwnerUsername;
        character.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password);
        character.UpdatedAt = DateTime.UtcNow;

        _repository.SaveCharacter(character);
        return character;
    }

    public bool ResetCharacterPassword(Guid characterId)
    {
        var character = _repository.GetCharacter(characterId);
        if (character == null)
            return false;

        character.PasswordHash = null;
        character.OwnerId = null;
        character.UpdatedAt = DateTime.UtcNow;

        _repository.SaveCharacter(character);
        return true;
    }
}
