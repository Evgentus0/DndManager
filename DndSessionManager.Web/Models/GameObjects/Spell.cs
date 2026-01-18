using System.Text.Json.Serialization;
using DndSessionManager.Web.Helpers.JsonConverters;

namespace DndSessionManager.Web.Models.GameObjects;

public class Spell : BaseGameObject
{
	[JsonPropertyName("desc")]
	public List<string> Desc { get; set; } = [];

	[JsonPropertyName("higher_level")]
	public List<string>? HigherLevel { get; set; }

	[JsonPropertyName("range")]
	public string Range { get; set; } = string.Empty;

	[JsonPropertyName("components")]
	public List<string> Components { get; set; } = [];

	[JsonPropertyName("material")]
	public string? Material { get; set; }

	[JsonPropertyName("ritual")]
	public bool Ritual { get; set; }

	[JsonPropertyName("duration")]
	public string Duration { get; set; } = string.Empty;

	[JsonPropertyName("concentration")]
	public bool Concentration { get; set; }

	[JsonPropertyName("casting_time")]
	public string CastingTime { get; set; } = string.Empty;

	[JsonPropertyName("level")]
	public int Level { get; set; }

	[JsonPropertyName("attack_type")]
	public string? AttackType { get; set; }

	[JsonPropertyName("damage")]
	[JsonConverter(typeof(SingleOrArrayConverter<SpellDamageInfo>))]
	public List<SpellDamageInfo>? Damage { get; set; }

	[JsonPropertyName("dc")]
	public SpellDcInfo? Dc { get; set; }

	[JsonPropertyName("school")]
	public BaseGameObject School { get; set; } = new();

	[JsonPropertyName("classes")]
	public List<Class> Classes { get; set; } = [];

	[JsonPropertyName("subclasses")]
	public List<BaseGameObject> Subclasses { get; set; } = [];
}

public class SpellDamageInfo
{
	[JsonPropertyName("damage_type")]
	public BaseGameObject? DamageType { get; set; }

	[JsonPropertyName("damage_at_slot_level")]
	public Dictionary<string, string>? DamageAtSlotLevel { get; set; }

	[JsonPropertyName("damage_at_character_level")]
	public Dictionary<string, string>? DamageAtCharacterLevel { get; set; }
}

public class SpellDcInfo
{
	[JsonPropertyName("dc_type")]
	public AbilityScore? DcType { get; set; }

	[JsonPropertyName("success_type")]
	public string? SuccessType { get; set; }
}
