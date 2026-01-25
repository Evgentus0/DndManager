namespace DndSessionManager.Web.Models;

/// <summary>
/// Represents a racial trait possessed by a character.
/// Uses handbook reference pattern (like CharacterSpellItem).
/// </summary>
public class CharacterTraitItem
{
	/// <summary>
	/// Unique identifier for this specific trait instance.
	/// </summary>
	public Guid Id { get; set; } = Guid.NewGuid();

	/// <summary>
	/// Reference to handbook trait index (e.g., "darkvision", "fey-ancestry").
	/// </summary>
	public string TraitIndex { get; set; } = string.Empty;

	/// <summary>
	/// Cached display name from handbook (for offline/localization).
	/// </summary>
	public string TraitName { get; set; } = string.Empty;
}
