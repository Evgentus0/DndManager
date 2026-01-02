using System.Text.Json;
using System.Text.Json.Serialization;

namespace DndSessionManager.Web.Models.GameObjects
{
	public class Monster
	{
		[JsonPropertyName("index")]
		public string Index { get; set; } = string.Empty;

		[JsonPropertyName("name")]
		public string Name { get; set; } = string.Empty;

		[JsonPropertyName("url")]
		public string Url { get; set; } = string.Empty;

		// Use extension data to capture all other properties flexibly
		// This allows the DTO to work with any monster without defining every possible field
		[JsonExtensionData]
		public Dictionary<string, JsonElement>? AdditionalData { get; set; }
	}
}
