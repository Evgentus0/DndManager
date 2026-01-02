using System.Text.Json.Serialization;

namespace DndSessionManager.Web.Models.GameObjects
{
	public class MagicSchool
	{
		[JsonPropertyName("index")]
		public string Index { get; set; } = string.Empty;

		[JsonPropertyName("name")]
		public string Name { get; set; } = string.Empty;

		[JsonPropertyName("desc")]
		public string? Desc { get; set; } = string.Empty;
	}
}
