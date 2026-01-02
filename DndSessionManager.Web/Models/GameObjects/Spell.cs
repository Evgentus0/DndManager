using DndSessionManager.Web.Helpers.JsonConverters;
using System.Text.Json.Serialization;

namespace DndSessionManager.Web.Models.GameObjects
{
	public class Spell
	{
		[JsonPropertyName("index")]
		public string Index { get; set; } = string.Empty;

		[JsonPropertyName("name")]
		public string Name { get; set; } = string.Empty;

		[JsonPropertyName("desc")]
		public List<string> Desc { get; set; } = new();

		[JsonPropertyName("higher_level")]
		public List<string>? HigherLevel { get; set; }

		[JsonPropertyName("range")]
		public string Range { get; set; } = string.Empty;

		[JsonPropertyName("components")]
		public List<string> Components { get; set; } = new();

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
		public MagicSchool School { get; set; } = new();

		[JsonPropertyName("classes")]
		public List<Class> Classes { get; set; } = new();

		[JsonPropertyName("subclasses")]
		public List<Subclass> Subclasses { get; set; } = new();
	}
}
