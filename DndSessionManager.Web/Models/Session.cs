using LiteDB;

namespace DndSessionManager.Web.Models;

public class Session
{
    [BsonId]
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public int MaxPlayers { get; set; } = 6;
    public bool IsOpen { get; set; } = true;
    public Guid MasterId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [BsonIgnore]
    public List<User> Users { get; set; } = new List<User>();
    public string? Description { get; set; }

    // Persistence properties
    public SessionState State { get; set; } = SessionState.Active;
    public DateTime? LastSavedAt { get; set; }
    public DateTime? LastPlayedAt { get; set; }
    public string? MasterUsername { get; set; }
}
