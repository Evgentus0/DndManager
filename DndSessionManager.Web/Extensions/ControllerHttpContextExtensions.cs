using System.Text.Json;

namespace DndSessionManager.Web.Extensions;

public static class ControllerHttpContextExtensions
{
	public static void SetUserToSession(this HttpContext context, string sessionId, string userId, string? username = null)
	{
		context.Session.SetString($"UserId_{sessionId}", userId);

		if (!string.IsNullOrEmpty(username))
		{
			context.Session.SetString($"Username_{sessionId}", username);
		}
	}

	public static string? GetUserIdBySession(this HttpContext context, string sessionId)
	{
		return context.Session.GetString($"UserId_{sessionId}") ?? default;
	}

	public static string? GetUsernameBySession(this HttpContext context, string sessionId)
	{
		return context.Session.GetString($"Username_{sessionId}") ?? default;
	}

	public static void RemoveUserFromSession(this HttpContext context, string sessionId)
	{
		context.Session.Remove($"UserId_{sessionId}");
		context.Session.Remove($"Username_{sessionId}");
	}

	public static void AddCurrentGameSession(this HttpContext context, string sessionId, string sessionName)
	{
		context.Session.SetString("CurrentGameSession",
			JsonSerializer.Serialize(new
			{
				sessionId = sessionId,
				sessionName = sessionName
			}));
	}

	public static void RemoveCurrentGameSession(this HttpContext context)
	{
		context.Session.Remove("CurrentGameSession");
	}

	public static string? GetCurrentGameSessionJson(this HttpContext context)
	{
		return context.Session.GetString("CurrentGameSession") ?? default;
	}
}
