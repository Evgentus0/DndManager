namespace DndSessionManager.Web.Models;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Username { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public Guid SessionId { get; set; }
    public string ConnectionId { get; set; } = string.Empty;
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

    // Character reference (for future use)
    public Guid? CharacterId { get; set; }
}
