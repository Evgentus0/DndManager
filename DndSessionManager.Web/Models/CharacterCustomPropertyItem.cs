namespace DndSessionManager.Web.Models;

/// <summary>
/// Represents a custom property/characteristic for a character.
/// Allows players to add custom features, traits, or special abilities.
/// </summary>
public class CharacterCustomPropertyItem
{
	/// <summary>
	/// Unique identifier for this custom property instance.
	/// </summary>
	public Guid Id { get; set; } = Guid.NewGuid();

	/// <summary>
	/// Name/title of the custom property.
	/// </summary>
	public string Name { get; set; } = string.Empty;

	/// <summary>
	/// Description or details of the custom property.
	/// </summary>
	public string Description { get; set; } = string.Empty;
}
