using System.Text.Json.Serialization;

namespace DndSessionManager.Web.Models.GameObjects
{
	public class SpellDcInfo
	{
		[JsonPropertyName("dc_type")]
		public AbilityScore? DcType { get; set; }

		[JsonPropertyName("success_type")]
		public string? SuccessType { get; set; }
	}
}
