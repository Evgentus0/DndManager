using System.Text.Json;
using System.Text.Json.Serialization;

namespace DndSessionManager.Web.Models.GameObjects
{
	public class Trait
	{
		[JsonPropertyName("index")]
		public string Index { get; set; } = string.Empty;

		[JsonPropertyName("name")]
		public string Name { get; set; } = string.Empty;

		[JsonPropertyName("url")]
		public string Url { get; set; } = string.Empty;

		[JsonExtensionData]
		public Dictionary<string, JsonElement>? AdditionalData { get; set; }
	}
}
