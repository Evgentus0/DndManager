using System.Text.Json;
using System.Text.Json.Serialization;

namespace DndSessionManager.Web.Helpers.JsonConverters
{
	public class SingleOrArrayConverter<T> : JsonConverter<List<T>?>
	{
		public override List<T>? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
		{
			if (reader.TokenType == JsonTokenType.Null)
			{
				return null;
			}

			if (reader.TokenType == JsonTokenType.StartArray)
			{
				return JsonSerializer.Deserialize<List<T>>(ref reader, options);
			}

			if (reader.TokenType == JsonTokenType.StartObject)
			{
				var item = JsonSerializer.Deserialize<T>(ref reader, options);
				return item != null ? new List<T> { item } : null;
			}

			throw new JsonException($"Unexpected token type: {reader.TokenType}");
		}

		public override void Write(Utf8JsonWriter writer, List<T>? value, JsonSerializerOptions options)
		{
			JsonSerializer.Serialize(writer, value, options);
		}
	}
}
