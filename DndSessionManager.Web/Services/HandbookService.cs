using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

namespace DndSessionManager.Web.Services;

public class HandbookService
{
	private readonly IMemoryCache _cache;
	private readonly IWebHostEnvironment _env;
	private readonly ILogger<HandbookService> _logger;

	public HandbookService(
		IMemoryCache cache,
		IWebHostEnvironment env,
		ILogger<HandbookService> logger)
	{
		_cache = cache;
		_env = env;
		_logger = logger;
	}

	/// <summary>
	/// Gets full entities list of specified type in the given language
	/// </summary>
	public List<T> GetEntities<T>(string language, string entityType)
	{
		var cacheKey = $"{language}:{entityType}";

		if (_cache.TryGetValue(cacheKey, out List<T>? cached) && cached != null)
		{
			return cached;
		}

		var dataFolder = language == "ru" ? "Ru2014" : "Eng2014";
		var path = Path.Combine(_env.ContentRootPath, "Data", dataFolder, $"5e-SRD-{entityType}.json");

		if (!File.Exists(path))
		{
			_logger.LogWarning("Data file not found: {Path}", path);
			return [];
		}

		try
		{
			var json = File.ReadAllText(path);
			var options = new JsonSerializerOptions
			{
				PropertyNameCaseInsensitive = true
			};
			var entities = JsonSerializer.Deserialize<List<T>>(json, options);

			if (entities == null)
			{
				_logger.LogWarning("Failed to deserialize data file: {Path}", path);
				return [];
			}

			_cache.Set(cacheKey, entities, new MemoryCacheEntryOptions
			{
				Priority = CacheItemPriority.Normal,
				AbsoluteExpirationRelativeToNow = null // No expiration
			});

			return entities;
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Error loading data from {Path}", path);
			return [];
		}
	}

	/// <summary>
	/// Gets a single entity by index
	/// </summary>
	public T? GetEntity<T>(string language, string entityType, string index) where T : class
	{
		var entities = GetEntities<T>(language, entityType);
		var entityObj = entities.FirstOrDefault(e =>
		{
			var prop = e.GetType().GetProperty("Index");
			return prop?.GetValue(e)?.ToString()?.Equals(index, StringComparison.OrdinalIgnoreCase) ?? false;
		});

		return entityObj;
	}
}
