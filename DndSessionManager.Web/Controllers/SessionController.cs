using DndSessionManager.Web.Extensions;
using DndSessionManager.Web.Models;
using DndSessionManager.Web.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ViewComponents;

namespace DndSessionManager.Web.Controllers;

public class SessionController : Controller
{
    private readonly SessionService _sessionService;
    private readonly UserService _userService;
    private readonly CharacterService _characterService;
    private readonly BattleMapService _battleMapService;
    private readonly ILogger<SessionController> _logger;

    public SessionController(SessionService sessionService, UserService userService, CharacterService characterService, BattleMapService battleMapService, ILogger<SessionController> logger)
    {
        _sessionService = sessionService;
        _userService = userService;
        _characterService = characterService;
        _battleMapService = battleMapService;
        _logger = logger;
    }

    // GET: /session/create
    [HttpGet]
    public IActionResult Create()
    {
        return View();
    }

    // POST: /session/create
    [HttpPost]
    public IActionResult Create(string sessionName, string joinPassword, string masterPassword, int maxPlayers = 6, string? description = null)
    {
        if (string.IsNullOrWhiteSpace(sessionName) || string.IsNullOrWhiteSpace(joinPassword) || string.IsNullOrWhiteSpace(masterPassword))
        {
            ModelState.AddModelError("", "Session name and both passwords are required.");
            return View();
        }

        if (maxPlayers < 2 || maxPlayers > 20)
        {
            ModelState.AddModelError("", "Max players must be between 2 and 20.");
            return View();
        }

        // Create a master user
        var masterUser = new User
        {
            Username = "Game Master",
            Role = UserRole.Master
        };

        // Create the session with both passwords
        var session = _sessionService.CreateSession(sessionName, joinPassword, masterPassword, maxPlayers, description, masterUser.Id, masterUser.Username);

        // Set the session ID for the user
        masterUser.SessionId = session.Id;

        // Add master to the session
        _sessionService.AddUserToSession(session.Id, masterUser);

        HttpContext.SetUserToSession(session.Id.ToString(), masterUser.Id.ToString());

		return RedirectToAction("Lobby", new { id = session.Id });
    }

    // GET: /session/browse
    [HttpGet]
    public IActionResult Browse()
    {
        var sessions = _sessionService.GetAllSessionsForBrowse();
        return View(sessions);
    }

    // GET: /session/resume/{id}
    [HttpGet]
    public IActionResult Resume(Guid id)
    {
        var session = _sessionService.GetSessionFromDb(id);
        if (session == null || session.State != SessionState.Saved)
        {
            return NotFound("Saved session not found.");
        }

        ViewBag.SessionId = id;
        ViewBag.SessionName = session.Name;
        return View();
    }

    // POST: /session/resume/{id}
    [HttpPost]
    public IActionResult Resume(Guid id, string password)
    {
        if (string.IsNullOrWhiteSpace(password))
        {
            ModelState.AddModelError("", "Password is required.");
            ViewBag.SessionId = id;
            return View();
        }

        var savedSession = _sessionService.GetSessionFromDb(id);
        if (savedSession == null || savedSession.State != SessionState.Saved)
        {
            return NotFound("Saved session not found.");
        }

        if (!_sessionService.ValidateMasterPassword(id, password))
        {
            ModelState.AddModelError("", "Incorrect master password.");
            ViewBag.SessionId = id;
            ViewBag.SessionName = savedSession.Name;
            return View();
        }

        // Resume the session
        var session = _sessionService.ResumeSession(id);
        if (session == null)
        {
            ModelState.AddModelError("", "Failed to resume session.");
            ViewBag.SessionId = id;
            ViewBag.SessionName = savedSession.Name;
            return View();
        }

        // Create master user for resumed session
        var masterUser = new User
        {
            Id = session.MasterId,
            Username = session.MasterUsername ?? "Game Master",
            Role = UserRole.Master,
            SessionId = session.Id
        };

        // Add master to the session
        _sessionService.AddUserToSession(session.Id, masterUser);

		// Store user ID in session
		HttpContext.SetUserToSession(session.Id.ToString(), masterUser.Id.ToString());

		return RedirectToAction("Lobby", new { id = session.Id });
    }

	// POST: /session/delete/{id}
	[HttpGet]
	public IActionResult Delete(Guid id)
	{
		var session = _sessionService.GetSessionFromDb(id);
		if (session == null)
		{
			return NotFound("Saved not found.");
		}

		ViewBag.SessionId = id;
		ViewBag.SessionName = session.Name;
		return View();
	}

	// POST: /session/delete/{id}
	[HttpPost]
	public IActionResult Delete(Guid id, string password)
	{
		if (string.IsNullOrWhiteSpace(password))
		{
			ModelState.AddModelError("", "Password is required.");
			ViewBag.SessionId = id;
			return View();
		}

		var session = _sessionService.GetSessionFromDb(id);
		if (session == null)
		{
			return NotFound("Saved not found.");
		}

		if (!_sessionService.ValidateMasterPassword(id, password))
		{
			ModelState.AddModelError("", "Incorrect master password.");
			ViewBag.SessionId = id;
			ViewBag.SessionName = session.Name;
			return View();
		}

		_sessionService.DeleteSavedSession(id);
		return RedirectToAction("Browse");
	}

    // GET: /session/join/{id}
    [HttpGet]
    public IActionResult Join(Guid id)
    {
        var session = _sessionService.GetSession(id);
        if (session == null)
        {
            return NotFound("Session not found.");
        }

        ViewBag.SessionId = id;
        ViewBag.SessionName = session.Name;
        return View();
    }

    // POST: /session/join/{id}
    [HttpPost]
    public IActionResult Join(Guid id, string username, string password)
    {
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
        {
            ModelState.AddModelError("", "Username and password are required.");
            ViewBag.SessionId = id;
            return View();
        }

        var session = _sessionService.GetSession(id);
        if (session == null)
        {
            return NotFound("Session not found.");
        }

        if (!session.IsOpen)
        {
            ModelState.AddModelError("", "This session is closed to new players.");
            ViewBag.SessionId = id;
            ViewBag.SessionName = session.Name;
            return View();
        }

        if (session.Users.Count >= session.MaxPlayers)
        {
            ModelState.AddModelError("", "This session is full.");
            ViewBag.SessionId = id;
            ViewBag.SessionName = session.Name;
            return View();
        }

        if (!_sessionService.ValidatePassword(id, password))
        {
            ModelState.AddModelError("", "Incorrect password.");
            ViewBag.SessionId = id;
            ViewBag.SessionName = session.Name;
            return View();
        }

        // Check if username is already taken in this session
        if (session.Users.Any(u => u.Username.Equals(username, StringComparison.OrdinalIgnoreCase)))
        {
            ModelState.AddModelError("", "Username is already taken in this session.");
            ViewBag.SessionId = id;
            ViewBag.SessionName = session.Name;
            return View();
        }

        // Create player user
        var playerUser = new User
        {
            Username = username,
            Role = UserRole.Player,
            SessionId = id
        };

		// Add player to session
		if (!_sessionService.AddUserToSession(id, playerUser))
		{
			ModelState.AddModelError("", "Failed to join session.");
			ViewBag.SessionId = id;
			ViewBag.SessionName = session.Name;
			return View();
		}

		// Store user ID and username in session
		HttpContext.SetUserToSession(id.ToString(), playerUser.Id.ToString(), username);

        // Redirect to character selection instead of lobby
        return RedirectToAction("CharacterSelect", new { id });
    }

    // GET: /session/{id}/lobby
    [HttpGet]
    public IActionResult Lobby(Guid id)
    {
        var session = _sessionService.GetSession(id);
        if (session == null)
        {
            return NotFound("Session not found.");
        }

        // Get user ID from session
        var userIdStr = HttpContext.GetUserIdBySession(id.ToString());
        if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
        {
            return RedirectToAction("Join", new { id });
        }

        var user = _userService.GetUser(id, userId);
        if (user == null)
        {
            return RedirectToAction("Join", new { id });
        }

        // Check if user has a character (required to enter lobby)
        if (user.Role != UserRole.Master && !_characterService.HasCharacter(id, userId))
        {
            return RedirectToAction("CharacterSelect", new { id });
        }

        ViewBag.Session = session;
        ViewBag.CurrentUser = user;
        ViewBag.IsMaster = user.Role == UserRole.Master;
		ViewBag.CurrentCharacter = user.Role == UserRole.Master
			? null
			: _characterService.GetCharacterByOwner(id, userId);

		HttpContext.AddCurrentGameSession(session.Id.ToString(), session.Name);

		return View();
    }

    // POST: /session/{id}/leave
    [HttpPost]
    public IActionResult Leave(Guid id)
    {
        var userIdStr = HttpContext.GetUserIdBySession(id.ToString());
        if (!string.IsNullOrEmpty(userIdStr) && Guid.TryParse(userIdStr, out var userId))
        {
            _sessionService.RemoveUserFromSession(id, userId);
            HttpContext.RemoveUserFromSession(id.ToString());
			HttpContext.RemoveCurrentGameSession();
		}

        return RedirectToAction("Index", "Home");
    }

    // GET: /session/{id}/characterselect
    [HttpGet]
    public IActionResult CharacterSelect(Guid id)
    {
        var session = _sessionService.GetSession(id);
        if (session == null)
        {
            return NotFound("Session not found.");
        }

        var userIdStr = HttpContext.GetUserIdBySession(id.ToString());
        if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
        {
            return RedirectToAction("Join", new { id });
        }

        var user = _userService.GetUser(id, userId);
        if (user == null)
        {
            return RedirectToAction("Join", new { id });
        }

        // Check if user already has a character (already selected)
        if (_characterService.HasCharacter(id, userId))
        {
            return RedirectToAction("Lobby", new { id });
        }

        var characters = _characterService.GetSessionCharacters(id).ToList();

        ViewBag.Session = session;
        ViewBag.CurrentUser = user;
        ViewBag.Characters = characters;

        return View();
    }

    // POST: /session/{id}/claimcharacter
    [HttpPost]
    public IActionResult ClaimCharacter(Guid id, Guid characterId, string? characterPassword, string? newPassword)
    {
        var session = _sessionService.GetSession(id);
        if (session == null)
        {
            return NotFound("Session not found.");
        }

        var userIdStr = HttpContext.GetUserIdBySession(id.ToString());
        var username = HttpContext.GetUsernameBySession(id.ToString()) ?? "Unknown";
        if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
        {
            return RedirectToAction("Join", new { id });
        }

        var character = _characterService.GetCharacter(characterId);
        if (character == null || character.SessionId != id)
        {
            TempData["Error"] = "Character not found.";
            return RedirectToAction("CharacterSelect", new { id });
        }

        // Check if character is already owned by someone online
        var currentOwner = character.OwnerId.HasValue
            ? session.Users.FirstOrDefault(u => u.Id == character.OwnerId.Value)
            : null;
        if (currentOwner != null)
        {
            TempData["Error"] = "This character is already being played by someone.";
            return RedirectToAction("CharacterSelect", new { id });
        }

        // If character has no password (unclaimed or reset), just claim it with new password
        if (!_characterService.IsCharacterClaimed(character))
        {
            if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 4)
            {
                TempData["Error"] = "Password is required (minimum 4 characters).";
                return RedirectToAction("CharacterSelect", new { id });
            }

            _characterService.ClaimCharacter(characterId, userId, username, newPassword);
            return RedirectToAction("Lobby", new { id });
        }

        // Character has a password - verify it
        if (string.IsNullOrWhiteSpace(characterPassword))
        {
            TempData["Error"] = "Character password is required.";
            return RedirectToAction("CharacterSelect", new { id });
        }

        if (!_characterService.ValidateCharacterPassword(characterId, characterPassword))
        {
            TempData["Error"] = "Incorrect character password.";
            return RedirectToAction("CharacterSelect", new { id });
        }

        // Password correct - update ownership (keep same password)
        character.OwnerId = userId;
        character.OwnerUsername = username;
        _characterService.UpdateCharacter(character);

        return RedirectToAction("Lobby", new { id });
    }

    // GET: /session/{id}/battlemap
    [HttpGet]
    public IActionResult BattleMap(Guid id)
    {
        var session = _sessionService.GetSession(id);
        if (session == null)
        {
            return NotFound("Session not found.");
        }

        var userIdStr = HttpContext.GetUserIdBySession(id.ToString());
        if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
        {
            return RedirectToAction("Join", new { id });
        }

        var user = _userService.GetUser(id, userId);
        if (user == null)
        {
            return RedirectToAction("Join", new { id });
        }

        // Ensure battle map exists
        var map = _battleMapService.GetBattleMapBySession(id);
        if (map == null)
        {
            // Create default map
            map = _battleMapService.CreateBattleMap(id);
        }

        ViewBag.Session = session;
        ViewBag.CurrentUser = user;
        ViewBag.IsMaster = user.Role == UserRole.Master;
        ViewBag.BattleMap = map;

        HttpContext.AddCurrentGameSession(session.Id.ToString(), session.Name);

        return View();
    }

    // POST: /session/UploadBattleMapBackground/{id}
    [HttpPost]
    public async Task<IActionResult> UploadBattleMapBackground(Guid id, IFormFile backgroundImage)
    {
        // Validate user is DM
        var userIdStr = HttpContext.GetUserIdBySession(id.ToString());
        if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
        {
            return Json(new { success = false, error = "User not authenticated" });
        }

        var user = _userService.GetUser(id, userId);
        if (user == null || user.Role != UserRole.Master)
        {
            return Json(new { success = false, error = "Only the DM can upload background images" });
        }

        // Validate file
        if (backgroundImage == null || backgroundImage.Length == 0)
        {
            return Json(new { success = false, error = "No file uploaded" });
        }

        // Validate file size (10MB max)
        if (backgroundImage.Length > 20 * 1024 * 1024)
        {
            return Json(new { success = false, error = "File too large (max 10MB)" });
        }

        // Validate file type
        var allowedTypes = new[] { "image/png", "image/jpeg", "image/jpg" };
        if (!allowedTypes.Contains(backgroundImage.ContentType?.ToLower()))
        {
            return Json(new { success = false, error = "Only PNG and JPEG images are supported" });
        }

        try
        {
            // Create directory if it doesn't exist
            var uploadDir = Path.Combine("wwwroot", "uploads", "battlemap-backgrounds", id.ToString());
            Directory.CreateDirectory(uploadDir);

            // Generate unique filename
            var extension = Path.GetExtension(backgroundImage.FileName);
            var filename = $"{Guid.NewGuid()}{extension}";
            var filePath = Path.Combine(uploadDir, filename);

            // Save file
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await backgroundImage.CopyToAsync(stream);
            }

            // Get map and delete old background if exists
            var map = _battleMapService.GetBattleMapBySession(id);
            if (map != null && !string.IsNullOrEmpty(map.Background.ImageUrl))
            {
                var oldFilePath = Path.Combine("wwwroot", map.Background.ImageUrl.TrimStart('/'));
                if (System.IO.File.Exists(oldFilePath))
                {
                    System.IO.File.Delete(oldFilePath);
                }
            }

            // Return URL path
            var imageUrl = $"/uploads/battlemap-backgrounds/{id}/{filename}";
            return Json(new { success = true, imageUrl });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading battle map background");
            return Json(new { success = false, error = "Upload failed" });
        }
    }

    // POST: /session/RemoveBattleMapBackground/{id}
    [HttpPost]
    public IActionResult RemoveBattleMapBackground(Guid id)
    {
        // Validate user is DM
        var userIdStr = HttpContext.GetUserIdBySession(id.ToString());
        if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
        {
            return Json(new { success = false, error = "User not authenticated" });
        }

        var user = _userService.GetUser(id, userId);
        if (user == null || user.Role != UserRole.Master)
        {
            return Json(new { success = false, error = "Only the DM can remove background images" });
        }

        try
        {
            // Get map and delete background file if exists
            var map = _battleMapService.GetBattleMapBySession(id);
            if (map != null && !string.IsNullOrEmpty(map.Background.ImageUrl))
            {
                var filePath = Path.Combine("wwwroot", map.Background.ImageUrl.TrimStart('/'));
                if (System.IO.File.Exists(filePath))
                {
                    System.IO.File.Delete(filePath);
                }

                // Update map to clear image URL
                _battleMapService.RemoveBackgroundImage(map.Id);
            }

            return Json(new { success = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing battle map background");
            return Json(new { success = false, error = "Remove failed" });
        }
    }
}
