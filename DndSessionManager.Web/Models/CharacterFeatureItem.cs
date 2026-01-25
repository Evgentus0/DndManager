namespace DndSessionManager.Web.Models;

/// <summary>
/// Represents a class feature known by a character.
/// Uses handbook reference pattern (like CharacterSpellItem).
/// </summary>
public class CharacterFeatureItem
{
	/// <summary>
	/// Unique identifier for this specific feature instance.
	/// </summary>
	public Guid Id { get; set; } = Guid.NewGuid();

	/// <summary>
	/// Reference to handbook feature index (e.g., "rage", "action-surge").
	/// </summary>
	public string FeatureIndex { get; set; } = string.Empty;

	/// <summary>
	/// Cached display name from handbook (for offline/localization).
	/// </summary>
	public string FeatureName { get; set; } = string.Empty;

	/// <summary>
	/// Level at which this feature is unlocked.
	/// </summary>
	public int Level { get; set; }
}
