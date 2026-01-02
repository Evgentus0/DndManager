using System.Text.Json.Serialization;

namespace DndSessionManager.Web.Models.GameObjects
{
	public class Class
	{
		[JsonPropertyName("index")]
		public string Index { get; set; } = string.Empty;

		[JsonPropertyName("name")]
		public string Name { get; set; } = string.Empty;

		// add other fields as nullable later
	}
}
