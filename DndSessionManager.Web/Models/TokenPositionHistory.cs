using LiteDB;

namespace DndSessionManager.Web.Models;

/// <summary>
/// Tracks player token positions across different maps
/// Allows restoring token positions when switching back to a previously visited map
/// </summary>
public class TokenPositionHistory
{
	[BsonId]
	public Guid Id { get; set; } = Guid.NewGuid();

	public Guid SessionId { get; set; }
	public Guid UserId { get; set; }  // Matches BattleToken.OwnerId
	public Guid MapId { get; set; }

	public int X { get; set; }
	public int Y { get; set; }

	public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
