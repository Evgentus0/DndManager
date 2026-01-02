using System.Text.Json.Serialization;

namespace DndSessionManager.Web.Models.GameObjects
{
	public class SpellDamageInfo
	{
		[JsonPropertyName("damage_type")]
		public DamageType? DamageType { get; set; }

		[JsonPropertyName("damage_at_slot_level")]
		public Dictionary<string, string>? DamageAtSlotLevel { get; set; }

		[JsonPropertyName("damage_at_character_level")]
		public Dictionary<string, string>? DamageAtCharacterLevel { get; set; }
	}
}
