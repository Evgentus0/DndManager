using Microsoft.AspNetCore.Mvc;
using DndSessionManager.Web.Models;
using DndSessionManager.Web.Services;

namespace DndSessionManager.Web.Controllers;

public class SessionController : Controller
{
    private readonly SessionService _sessionService;
    private readonly UserService _userService;
    private readonly ILogger<SessionController> _logger;

    public SessionController(SessionService sessionService, UserService userService, ILogger<SessionController> logger)
    {
        _sessionService = sessionService;
        _userService = userService;
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
    public IActionResult Create(string sessionName, string password, int maxPlayers = 6, string? description = null)
    {
        if (string.IsNullOrWhiteSpace(sessionName) || string.IsNullOrWhiteSpace(password))
        {
            ModelState.AddModelError("", "Session name and password are required.");
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

        // Create the session
        var session = _sessionService.CreateSession(sessionName, password, maxPlayers, description, masterUser.Id);

        // Set the session ID for the user
        masterUser.SessionId = session.Id;

        // Add master to the session
        _sessionService.AddUserToSession(session.Id, masterUser);

        // Store user ID in session
        HttpContext.Session.SetString($"UserId_{session.Id}", masterUser.Id.ToString());

        return RedirectToAction("Lobby", new { id = session.Id });
    }

    // GET: /session/browse
    [HttpGet]
    public IActionResult Browse()
    {
        var sessions = _sessionService.GetAllSessions();
        return View(sessions);
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

        // Store user ID in session
        HttpContext.Session.SetString($"UserId_{id}", playerUser.Id.ToString());

        return RedirectToAction("Lobby", new { id });
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
        var userIdStr = HttpContext.Session.GetString($"UserId_{id}");
        if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
        {
            return RedirectToAction("Join", new { id });
        }

        var user = _userService.GetUser(id, userId);
        if (user == null)
        {
            return RedirectToAction("Join", new { id });
        }

        ViewBag.Session = session;
        ViewBag.CurrentUser = user;
        ViewBag.IsMaster = user.Role == UserRole.Master;

        return View();
    }

    // POST: /session/{id}/leave
    [HttpPost]
    public IActionResult Leave(Guid id)
    {
        var userIdStr = HttpContext.Session.GetString($"UserId_{id}");
        if (!string.IsNullOrEmpty(userIdStr) && Guid.TryParse(userIdStr, out var userId))
        {
            _sessionService.RemoveUserFromSession(id, userId);
            HttpContext.Session.Remove($"UserId_{id}");
        }

        return RedirectToAction("Index", "Home");
    }
}
