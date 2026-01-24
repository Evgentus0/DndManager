namespace DndSessionManager.Web.Models;

/// <summary>
/// Represents a spell known by a character.
/// Uses handbook reference pattern (like CharacterEquipmentItem).
/// </summary>
public class CharacterSpellItem
{
    /// <summary>
    /// Unique identifier for this specific spell instance.
    /// </summary>
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Reference to handbook spell index (e.g., "fireball", "cure-wounds").
    /// </summary>
    public string SpellIndex { get; set; } = string.Empty;

    /// <summary>
    /// Cached display name from handbook (for offline/localization).
    /// </summary>
    public string SpellName { get; set; } = string.Empty;

    /// <summary>
    /// Spell level (0 = cantrip, 1-9 = leveled spells).
    /// </summary>
    public int Level { get; set; }

    /// <summary>
    /// Whether this spell is currently prepared.
    /// Cantrips (level 0) are always considered prepared.
    /// </summary>
    public bool IsPrepared { get; set; } = true;
}
