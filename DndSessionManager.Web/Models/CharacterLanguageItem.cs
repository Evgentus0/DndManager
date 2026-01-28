namespace DndSessionManager.Web.Models;

/// <summary>
/// Represents a language known by a character.
/// Uses handbook reference pattern (like CharacterTraitItem).
/// </summary>
public class CharacterLanguageItem
{
	/// <summary>
	/// Unique identifier for this specific language instance.
	/// </summary>
	public Guid Id { get; set; } = Guid.NewGuid();

	/// <summary>
	/// Reference to handbook language index (e.g., "common", "elvish").
	/// </summary>
	public string LanguageIndex { get; set; } = string.Empty;

	/// <summary>
	/// Cached display name from handbook (for offline/localization).
	/// </summary>
	public string LanguageName { get; set; } = string.Empty;
}
