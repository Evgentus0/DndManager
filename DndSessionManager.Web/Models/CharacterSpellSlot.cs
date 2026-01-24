namespace DndSessionManager.Web.Models;

/// <summary>
/// Tracks spell slots for a single spell level.
/// </summary>
public class CharacterSpellSlot
{
    /// <summary>
    /// Spell level (1-9). Cantrips don't use slots.
    /// </summary>
    public int Level { get; set; }

    /// <summary>
    /// Total available slots at this level.
    /// </summary>
    public int Total { get; set; }

    /// <summary>
    /// Currently used slots at this level.
    /// </summary>
    public int Used { get; set; }
}
