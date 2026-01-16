using DndSessionManager.Web.Models;

namespace DndSessionManager.Web.Services;

public class UserService
{
    private readonly SessionService _sessionService;

    public UserService(SessionService sessionService)
    {
        _sessionService = sessionService;
    }

    public User? GetUser(Guid sessionId, Guid userId)
    {
        var session = _sessionService.GetSession(sessionId);
        return session?.Users.FirstOrDefault(u => u.Id == userId);
    }

    public User? GetUserByConnectionId(string connectionId)
    {
        var sessions = _sessionService.GetAllSessions();
        foreach (var session in sessions)
        {
            var user = session.Users.FirstOrDefault(u => u.ConnectionId == connectionId);
            if (user != null)
                return user;
        }

        // Also check closed sessions
        return null;
    }

    public bool IsUserMaster(Guid sessionId, Guid userId)
    {
        var session = _sessionService.GetSession(sessionId);
        return session?.MasterId == userId;
    }

    public IEnumerable<User> GetSessionUsers(Guid sessionId)
    {
        var session = _sessionService.GetSession(sessionId);
        return session?.Users ?? Enumerable.Empty<User>();
    }

    public void UpdateConnectionId(Guid sessionId, Guid userId, string connectionId)
    {
        var user = GetUser(sessionId, userId);
        if (user != null)
        {
            user.ConnectionId = connectionId;
        }
    }
}
