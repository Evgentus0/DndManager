using DndSessionManager.Web.Models.GameObjects;
using DndSessionManager.Web.Services;
using Microsoft.AspNetCore.Mvc;

namespace DndSessionManager.Web.Controllers
{
	public class HandbookController : Controller
	{
		private readonly HandbookService _handbookService;
		private readonly ILogger<HandbookController> _logger;

		public HandbookController(HandbookService handbookService, ILogger<HandbookController> logger)
		{
			_handbookService = handbookService;
			_logger = logger;
		}

		/// <summary>
		/// Main handbook page
		/// </summary>
		[HttpGet]
		public IActionResult Index(string? category, string? index)
		{
			ViewBag.Category = category;
			ViewBag.Index = index;
			return View();
		}

		/// <summary>
		/// API endpoint to get full entity list (all properties for enhanced list view)
		/// Language is determined from X-Locale header
		/// </summary>
		[HttpGet("/api/handbook/{category}")]
		public IActionResult GetEntityList(string category)
		{
			var language = GetLanguageFromHeader();
			var entityType = MapCategoryToEntityType(category);

			if (string.IsNullOrEmpty(entityType))
			{
				return NotFound(new { error = $"Category '{category}' not found" });
			}

			object? entities = category switch
			{
				"spells" => _handbookService.GetEntities<Spell>(language, entityType),
				"classes" => _handbookService.GetEntities<Class>(language, entityType),
				"ability-scores" => _handbookService.GetEntities<AbilityScore>(language, entityType),

				"monsters"
				or "subclasses"
				or "equipment"
				or "magic-items"
				or "features"
				or "races"
				or "traits"
				or "languages"
				or "conditions"
				or "skills"
				or "damage-types"
				or "magic-schools"
				or "weapon-properties" => _handbookService.GetEntities<BaseGameObject>(language, entityType),
				_ => null
			};

			if (entities == null)
			{
				return NotFound(new { error = $"Entities not found for category '{category}'" });
			}

			Response.Headers.Append("Cache-Control", "public, max-age=3600");

			return Ok(entities);
		}

		/// <summary>
		/// API endpoint to get full entity details
		/// Language is determined from X-Locale header
		/// </summary>
		[HttpGet("/api/handbook/{category}/{index}")]
		public IActionResult GetEntity(string category, string index)
		{
			var language = GetLanguageFromHeader();
			var entityType = MapCategoryToEntityType(category);

			if (string.IsNullOrEmpty(entityType))
			{
				return NotFound(new { error = $"Category '{category}' not found" });
			}

			object? entity = category switch
			{
				"spells" => _handbookService.GetEntity<Spell>(language, entityType, index),
				"classes" => _handbookService.GetEntity<Class>(language, entityType, index),
				"ability-scores" => _handbookService.GetEntity<AbilityScore>(language, entityType, index),

				"monsters"
				or "subclasses"
				or "equipment"
				or "magic-items"
				or "features"
				or "races"
				or "traits"
				or "languages"
				or "conditions"
				or "skills"
				or "damage-types"
				or "magic-schools"
				or "weapon-properties" => _handbookService.GetEntity<BaseGameObject>(language, entityType, index),
				_ => null
			};

			if (entity == null)
			{
				return NotFound(new { error = $"Entity '{index}' not found in category '{category}'" });
			}

			Response.Headers.Append("Cache-Control", "public, max-age=3600");

			return Ok(entity);
		}

		/// <summary>
		/// Reads language from X-Locale header, defaults to 'en'
		/// </summary>
		private string GetLanguageFromHeader()
		{
			if (Request.Headers.TryGetValue("X-Locale", out var locale))
			{
				var lang = locale.ToString().ToLowerInvariant();
				return lang == "ru" ? "ru" : "en";
			}

			return "en";
		}

		/// <summary>
		/// Maps category name to entity type file name
		/// </summary>
		private string? MapCategoryToEntityType(string category)
		{
			return category.ToLowerInvariant() switch
			{
				"spells" => "Spells",
				"monsters" => "Monsters",
				"classes" => "Classes",
				"equipment" => "Equipment",
				"magic-items" => "Magic-Items",
				"features" => "Features",
				"races" => "Races",
				"conditions" => "Conditions",
				"skills" => "Skills",
				"ability-scores" => "Ability-Scores",
				"damage-types" => "Damage-Types",
				"magic-schools" => "Magic-Schools",
				"subclasses" => "Subclasses",
				"alignments" => "Alignments",
				"backgrounds" => "Backgrounds",
				"proficiencies" => "Proficiencies",
				"traits" => "Traits",
				"weapon-properties" => "Weapon-Properties",
				"equipment-categories" => "Equipment-Categories",
				"languages" => "Languages",
				"levels" => "Levels",
				"rules" => "Rules",
				"rule-sections" => "Rule-Sections",
				"feats" => "Feats",
				_ => null
			};
		}
	}
}
