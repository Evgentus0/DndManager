using System.Text.Json.Serialization;

namespace DndSessionManager.Web.Models.GameObjects
{
	public class ApiReference
	{
		[JsonPropertyName("index")]
		public string Index { get; set; } = string.Empty;

		[JsonPropertyName("name")]
		public string Name { get; set; } = string.Empty;

		[JsonPropertyName("url")]
		public string Url { get; set; } = string.Empty;
	}
}
