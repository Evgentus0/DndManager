using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using DndSessionManager.Web.Models;
using DndSessionManager.Web.Services;

namespace DndSessionManager.Web.Controllers;

public class HomeController : Controller
{
    private readonly ILogger<HomeController> _logger;
    private readonly SessionService _sessionService;

    public HomeController(ILogger<HomeController> logger, SessionService sessionService)
    {
        _logger = logger;
        _sessionService = sessionService;
    }

    public IActionResult Index()
    {
        ViewBag.ActiveSessionCount = _sessionService.GetAllSessions().Count();
        return View();
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
}
