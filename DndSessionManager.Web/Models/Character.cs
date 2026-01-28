namespace DndSessionManager.Web.Models;

/// <summary>
/// D&D character entity with full stats. Each player can have one character per session.
/// </summary>
public class Character
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid SessionId { get; set; }
    public Guid? OwnerId { get; set; }
    public string? OwnerUsername { get; set; }
    public string? PasswordHash { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Handbook references (index values like "elf", "fighter")
    public string? RaceIndex { get; set; }
    public string? ClassIndex { get; set; }

    // Display names (for custom entries or cached names)
    public string? RaceName { get; set; }
    public string? ClassName { get; set; }

    // Core stats
    public int Level { get; set; } = 1;
    public int MaxHitPoints { get; set; }
    public int CurrentHitPoints { get; set; }
    public int ArmorClass { get; set; } = 10;
    public int ProficiencyBonus { get; set; } = 2;

    // Coins (D&D 5e standard currency)
    public int CopperPieces { get; set; } = 0;
    public int SilverPieces { get; set; } = 0;
    public int ElectrumPieces { get; set; } = 0;
    public int GoldPieces { get; set; } = 0;
    public int PlatinumPieces { get; set; } = 0;

    // Ability scores
    public int Strength { get; set; } = 10;
    public int Dexterity { get; set; } = 10;
    public int Constitution { get; set; } = 10;
    public int Intelligence { get; set; } = 10;
    public int Wisdom { get; set; } = 10;
    public int Charisma { get; set; } = 10;

    // Additional info
    public string? Background { get; set; }
    public string? Notes { get; set; }

    // Skill proficiencies (list of skill indices like "athletics", "perception")
    public List<string> Skills { get; set; } = new();

    // Equipment items (list of equipment references with state)
    public List<CharacterEquipmentItem> Equipment { get; set; } = new();

    // Spells known by this character
    public List<CharacterSpellItem> Spells { get; set; } = new();

    // Spell slots per level (1-9)
    public List<CharacterSpellSlot> SpellSlots { get; set; } = new();

    // Features known by this character (class features)
    public List<CharacterFeatureItem> Features { get; set; } = new();

    // Traits possessed by this character (racial traits)
    public List<CharacterTraitItem> Traits { get; set; } = new();

    // Languages known by this character
    public List<CharacterLanguageItem> Languages { get; set; } = new();
}
