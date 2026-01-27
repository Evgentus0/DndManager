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

    /// <summary>
    /// Custom description for non-handbook spells.
    /// Only used when SpellIndex is empty or null.
    /// </summary>
    public string? CustomDescription { get; set; }

    /// <summary>
    /// Custom damage for non-handbook spells (e.g., "8d6 fire").
    /// Only used when SpellIndex is empty or null.
    /// </summary>
    public string? CustomDamage { get; set; }

    /// <summary>
    /// Custom damage type for non-handbook spells (e.g., "fire", "necrotic").
    /// Only used when SpellIndex is empty or null.
    /// </summary>
    public string? CustomDamageType { get; set; }
}
