namespace DndSessionManager.Web.Models;

/// <summary>
/// Represents a single piece of equipment owned by a character.
/// Uses handbook reference pattern (like RaceIndex/RaceName).
/// </summary>
public class CharacterEquipmentItem
{
    /// <summary>
    /// Unique identifier for this specific equipment instance.
    /// Allows multiple of same item type (e.g., two daggers).
    /// </summary>
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Reference to handbook equipment index (e.g., "shortbow", "longsword").
    /// </summary>
    public string EquipmentIndex { get; set; } = string.Empty;

    /// <summary>
    /// Cached display name from handbook (for offline/localization).
    /// </summary>
    public string EquipmentName { get; set; } = string.Empty;

    /// <summary>
    /// Quantity for stackable items (arrows, bolts, etc.).
    /// Default 1 for non-stackable items.
    /// </summary>
    public int Quantity { get; set; } = 1;

    /// <summary>
    /// For weapons with "ammunition" property: current loaded ammo count.
    /// Null for non-ammunition weapons.
    /// </summary>
    public int? CurrentAmmo { get; set; }

    /// <summary>
    /// Whether this item is currently equipped (vs. in inventory).
    /// </summary>
    public bool IsEquipped { get; set; } = true;

    /// <summary>
    /// Custom damage for non-handbook equipment (e.g., "1d8 slashing").
    /// Only used when EquipmentIndex is empty or null.
    /// </summary>
    public string? CustomDamage { get; set; }

    /// <summary>
    /// Custom description for non-handbook equipment.
    /// Only used when EquipmentIndex is empty or null.
    /// </summary>
    public string? CustomDescription { get; set; }

    /// <summary>
    /// Custom cost for non-handbook equipment (e.g., "15 gp").
    /// Only used when EquipmentIndex is empty or null.
    /// </summary>
    public string? CustomCost { get; set; }
}
