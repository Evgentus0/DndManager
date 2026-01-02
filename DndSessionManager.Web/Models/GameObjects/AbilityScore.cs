using System.Text.Json.Serialization;

namespace DndSessionManager.Web.Models.GameObjects
{
	public class AbilityScore
	{
		[JsonPropertyName("index")]
		public string Index { get; set; } = string.Empty;

		[JsonPropertyName("name")]
		public string Name { get; set; } = string.Empty;

		[JsonPropertyName("full_name")]
		public string? FullName { get; set; }

		[JsonPropertyName("desc")]
		public List<string>? Desc { get; set; }

		[JsonPropertyName("skills")]
		public List<SkillReference>? Skills { get; set; }
	}

	public class SkillReference
	{
		[JsonPropertyName("index")]
		public string Index { get; set; } = string.Empty;

		[JsonPropertyName("name")]
		public string Name { get; set; } = string.Empty;
	}
}
