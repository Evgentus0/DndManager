using System.Text.Json.Serialization;

namespace DndSessionManager.Web.Models.GameObjects
{
	public class WeaponProperty
	{
		[JsonPropertyName("index")]
		public string Index { get; set; } = string.Empty;

		[JsonPropertyName("name")]
		public string Name { get; set; } = string.Empty;

		[JsonPropertyName("desc")]
		public List<string>? Desc { get; set; } = new();
	}
}
