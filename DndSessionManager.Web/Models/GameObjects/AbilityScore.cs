using System.Text.Json.Serialization;

namespace DndSessionManager.Web.Models.GameObjects;

public class AbilityScore : BaseGameObject
{
	[JsonPropertyName("full_name")]
	public string? FullName { get; set; }

	[JsonPropertyName("desc")]
	public List<string>? Desc { get; set; }

	[JsonPropertyName("skills")]
	public List<BaseGameObject>? Skills { get; set; }
}
