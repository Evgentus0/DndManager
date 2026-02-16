using LiteDB;

namespace DndSessionManager.Web.Models;

/// <summary>
/// Stores the complete state of a character's battle token in the database.
/// Allows tokens to persist across user disconnects/reconnects with the same visual properties.
/// </summary>
public class PersistedToken
{
	[BsonId]
	public Guid Id { get; set; } = Guid.NewGuid();

	public Guid SessionId { get; set; }
	public Guid CharacterId { get; set; }  // Primary ownership: Character.Id
	public Guid? MapId { get; set; }       // Last known map

	// Complete visual state
	public string Name { get; set; } = string.Empty;
	public int Size { get; set; } = 1;
	public string Color { get; set; } = "#3498db";
	public string? ImageUrl { get; set; }  // CRITICAL: Preserves custom token image
	public string? IconName { get; set; }

	// Last known position
	public int X { get; set; } = 1;
	public int Y { get; set; } = 1;

	public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
	public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
