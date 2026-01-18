using System.Text.Json.Serialization;

namespace DndSessionManager.Web.Models.GameObjects;

public class Class : BaseGameObject
{
	[JsonPropertyName("hit_die")]
	public int? HitDie { get; set; }

}
