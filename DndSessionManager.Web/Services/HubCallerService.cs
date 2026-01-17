using DndSessionManager.Web.Hubs;
using DndSessionManager.Web.Models;
using Microsoft.AspNetCore.SignalR;

namespace DndSessionManager.Web.Services;

public interface IHubCallerService
{
	Task BrowseRefreshAvailableSessionsList(IEnumerable<Session> sessions);
	Task LobbyMasterLeave(string sessionId);
	Task LobbyUserLeft(string sessionId, User user);
}

public class HubCallerService(
	IHubContext<BrowseHub> browseHub,
	IHubContext<LobbyHub> lobbyHub
) : IHubCallerService
{

	public async Task BrowseRefreshAvailableSessionsList(IEnumerable<Session> sessions)
	{
		await browseHub.Clients.All.SendAsync("ReceiveAvailableSessionsList", sessions);
	}

	public async Task LobbyMasterLeave(string sessionId)
	{
		await lobbyHub.Clients.Group(sessionId).SendAsync("MasterLeave");
	}

	public async Task LobbyUserLeft(string sessionId, User user)
	{
		await lobbyHub.Clients.Group(sessionId).SendAsync("UserLeft", new
		{
			user.Id,
			user.Username
		});
	}
}
