namespace DndSessionManager.Web.Models;

/// <summary>
/// Stub for future Character entity. Players can claim existing characters
/// or create new ones when joining a session.
/// </summary>
public class Character
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid SessionId { get; set; }
    public Guid? OwnerId { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Future properties (stubs)
    public string? Race { get; set; }
    public string? Class { get; set; }
    public int Level { get; set; } = 1;
    public string? Notes { get; set; }

    // TODO: Add full character stats, inventory, abilities, etc.
}
