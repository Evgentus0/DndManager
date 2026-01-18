using DndSessionManager.Web.Models;
using DndSessionManager.Web.Services;
using Microsoft.AspNetCore.SignalR;

namespace DndSessionManager.Web.Hubs;

public class LobbyHub : Hub
{
	private readonly SessionService _sessionService;
	private readonly UserService _userService;
	private readonly CharacterService _characterService;

	public LobbyHub(SessionService sessionService, UserService userService, CharacterService characterService)
	{
		_sessionService = sessionService;
		_userService = userService;
		_characterService = characterService;
	}

	public async Task JoinLobby(string sessionId, string userId)
	{
		if (!Guid.TryParse(sessionId, out var sessionGuid) || !Guid.TryParse(userId, out var userGuid))
			return;

		var session = _sessionService.GetSession(sessionGuid);
		if (session == null)
			return;

		// Update connection ID
		_userService.UpdateConnectionId(sessionGuid, userGuid, Context.ConnectionId);

		// Join SignalR group for this session
		await Groups.AddToGroupAsync(Context.ConnectionId, sessionId);

		var user = _userService.GetUser(sessionGuid, userGuid);
		if (user != null)
		{
			// Notify others that user joined
			await Clients.Group(sessionId).SendAsync("UserJoined", new
			{
				user.Id,
				user.Username,
				Role = user.Role.ToString()
			});

			// Send current user list to the new user
			var users = session.Users.Select(u => new
			{
				u.Id,
				u.Username,
				Role = u.Role.ToString()
			});
			await Clients.Caller.SendAsync("InitialUserList", users);

			// Send chat history to the new user
			var messages = _sessionService.GetChatMessages(sessionGuid);
			await Clients.Caller.SendAsync("ChatHistory", messages.Select(m => new
			{
				m.Username,
				m.Message,
				m.Timestamp
			}));

			// Send character list to the new user
			var characters = _characterService.GetSessionCharacters(sessionGuid);
			await Clients.Caller.SendAsync("CharacterList", characters.Select(MapCharacterToDto));
		}
	}

	public async Task LeaveLobby(string sessionId, string userId)
	{
		if (!Guid.TryParse(sessionId, out var sessionGuid) || !Guid.TryParse(userId, out var userGuid))
			return;

		var user = _userService.GetUser(sessionGuid, userGuid);
		if (user != null)
		{
			await Clients.Group(sessionId).SendAsync("UserLeft", new
			{
				user.Id,
				user.Username
			});
		}

		await Groups.RemoveFromGroupAsync(Context.ConnectionId, sessionId);
	}

	public async Task SendMessage(string sessionId, string userId, string message)
	{
		if (!Guid.TryParse(sessionId, out var sessionGuid) || !Guid.TryParse(userId, out var userGuid))
			return;

		if (string.IsNullOrWhiteSpace(message))
			return;

		var user = _userService.GetUser(sessionGuid, userGuid);
		if (user != null)
		{
			var chatMessage = new ChatMessage
			{
				SessionId = sessionGuid,
				Username = user.Username,
				Message = message.Trim()
			};

			_sessionService.AddChatMessage(chatMessage);

			await Clients.Group(sessionId).SendAsync("ReceiveMessage", new
			{
				chatMessage.Username,
				chatMessage.Message,
				chatMessage.Timestamp
			});
		}
	}

	public async Task KickUser(string sessionId, string masterUserId, string targetUserId)
	{
		if (!Guid.TryParse(sessionId, out var sessionGuid) ||
			!Guid.TryParse(masterUserId, out var masterUserGuid) ||
			!Guid.TryParse(targetUserId, out var targetUserGuid))
			return;

		// Verify the requester is the master
		if (!_userService.IsUserMaster(sessionGuid, masterUserGuid))
			return;

		var targetUser = _userService.GetUser(sessionGuid, targetUserGuid);
		if (targetUser != null && targetUser.Role != UserRole.Master)
		{
			// Notify the kicked user
			if (!string.IsNullOrEmpty(targetUser.ConnectionId))
			{
				await Clients.Client(targetUser.ConnectionId).SendAsync("UserKicked");
			}

			// Remove user from session
			_sessionService.RemoveUserFromSession(sessionGuid, targetUserGuid);

			// Notify others
			await Clients.Group(sessionId).SendAsync("UserLeft", new
			{
				targetUser.Id,
				targetUser.Username
			});
		}
	}

	public async Task ToggleSessionOpen(string sessionId, string masterUserId, bool isOpen)
	{
		if (!Guid.TryParse(sessionId, out var sessionGuid) ||
			!Guid.TryParse(masterUserId, out var masterUserGuid))
			return;

		// Verify the requester is the master
		if (!_userService.IsUserMaster(sessionGuid, masterUserGuid))
			return;

		_sessionService.UpdateSessionOpen(sessionGuid, isOpen);

		await Clients.Group(sessionId).SendAsync("SessionOpenChanged", isOpen);
	}

	public override async Task OnDisconnectedAsync(Exception? exception)
	{
		// Find user by connection ID and notify others
		var sessions = _sessionService.GetAllSessions();
		foreach (var session in sessions)
		{
			var user = session.Users.FirstOrDefault(u => u.ConnectionId == Context.ConnectionId);
			if (user != null)
			{
				await Clients.Group(session.Id.ToString()).SendAsync("UserDisconnected", new
				{
					user.Id,
					user.Username
				});
				break;
			}
		}

		await base.OnDisconnectedAsync(exception);
	}

	// Character management methods
	public async Task CreateCharacter(string sessionId, string userId, CharacterDto characterData)
	{
		if (!Guid.TryParse(sessionId, out var sessionGuid) || !Guid.TryParse(userId, out var userGuid))
			return;

		var user = _userService.GetUser(sessionGuid, userGuid);
		if (user == null)
			return;

		// Check if user already has a character
		if (_characterService.HasCharacter(sessionGuid, userGuid))
		{
			await Clients.Caller.SendAsync("CharacterError", "You already have a character in this session.");
			return;
		}

		var character = new Character
		{
			SessionId = sessionGuid,
			OwnerId = userGuid,
			Name = characterData.Name,
			RaceIndex = characterData.RaceIndex,
			ClassIndex = characterData.ClassIndex,
			RaceName = characterData.RaceName,
			ClassName = characterData.ClassName,
			Level = characterData.Level,
			MaxHitPoints = characterData.MaxHitPoints,
			CurrentHitPoints = characterData.CurrentHitPoints,
			ArmorClass = characterData.ArmorClass,
			ProficiencyBonus = characterData.ProficiencyBonus,
			Strength = characterData.Strength,
			Dexterity = characterData.Dexterity,
			Constitution = characterData.Constitution,
			Intelligence = characterData.Intelligence,
			Wisdom = characterData.Wisdom,
			Charisma = characterData.Charisma,
			Background = characterData.Background,
			Notes = characterData.Notes,
			Skills = characterData.Skills ?? []
		};

		_characterService.CreateCharacter(character);

		await Clients.Group(sessionId).SendAsync("CharacterCreated", MapCharacterToDto(character));
	}

	public async Task UpdateCharacter(string sessionId, string userId, CharacterDto characterData)
	{
		if (!Guid.TryParse(sessionId, out var sessionGuid) ||
			!Guid.TryParse(userId, out var userGuid) ||
			!Guid.TryParse(characterData.Id, out var characterGuid))
			return;

		var user = _userService.GetUser(sessionGuid, userGuid);
		if (user == null)
			return;

		var existingCharacter = _characterService.GetCharacter(characterGuid);
		if (existingCharacter == null || existingCharacter.SessionId != sessionGuid)
			return;

		var isMaster = _userService.IsUserMaster(sessionGuid, userGuid);
		if (!_characterService.CanUserEditCharacter(userGuid, existingCharacter, isMaster))
		{
			await Clients.Caller.SendAsync("CharacterError", "You cannot edit this character.");
			return;
		}

		existingCharacter.Name = characterData.Name;
		existingCharacter.RaceIndex = characterData.RaceIndex;
		existingCharacter.ClassIndex = characterData.ClassIndex;
		existingCharacter.RaceName = characterData.RaceName;
		existingCharacter.ClassName = characterData.ClassName;
		existingCharacter.Level = characterData.Level;
		existingCharacter.MaxHitPoints = characterData.MaxHitPoints;
		existingCharacter.CurrentHitPoints = characterData.CurrentHitPoints;
		existingCharacter.ArmorClass = characterData.ArmorClass;
		existingCharacter.ProficiencyBonus = characterData.ProficiencyBonus;
		existingCharacter.Strength = characterData.Strength;
		existingCharacter.Dexterity = characterData.Dexterity;
		existingCharacter.Constitution = characterData.Constitution;
		existingCharacter.Intelligence = characterData.Intelligence;
		existingCharacter.Wisdom = characterData.Wisdom;
		existingCharacter.Charisma = characterData.Charisma;
		existingCharacter.Background = characterData.Background;
		existingCharacter.Notes = characterData.Notes;
		existingCharacter.Skills = characterData.Skills ?? [];

		_characterService.UpdateCharacter(existingCharacter);

		await Clients.Group(sessionId).SendAsync("CharacterUpdated", MapCharacterToDto(existingCharacter));
	}

	public async Task DeleteCharacter(string sessionId, string userId, string characterId)
	{
		if (!Guid.TryParse(sessionId, out var sessionGuid) ||
			!Guid.TryParse(userId, out var userGuid) ||
			!Guid.TryParse(characterId, out var characterGuid))
			return;

		var user = _userService.GetUser(sessionGuid, userGuid);
		if (user == null)
			return;

		var character = _characterService.GetCharacter(characterGuid);
		if (character == null || character.SessionId != sessionGuid)
			return;

		var isMaster = _userService.IsUserMaster(sessionGuid, userGuid);
		if (!_characterService.CanUserDeleteCharacter(userGuid, character, isMaster))
		{
			await Clients.Caller.SendAsync("CharacterError", "You cannot delete this character.");
			return;
		}

		_characterService.DeleteCharacter(characterGuid);

		await Clients.Group(sessionId).SendAsync("CharacterDeleted", characterId);
	}

	private static object MapCharacterToDto(Character c) => new
	{
		Id = c.Id.ToString(),
		OwnerId = c.OwnerId?.ToString(),
		c.Name,
		c.RaceIndex,
		c.ClassIndex,
		c.RaceName,
		c.ClassName,
		c.Level,
		c.MaxHitPoints,
		c.CurrentHitPoints,
		c.ArmorClass,
		c.ProficiencyBonus,
		c.Strength,
		c.Dexterity,
		c.Constitution,
		c.Intelligence,
		c.Wisdom,
		c.Charisma,
		c.Background,
		c.Notes,
		c.Skills
	};
}

public class CharacterDto
{
	public string? Id { get; set; }
	public string Name { get; set; } = string.Empty;
	public string? RaceIndex { get; set; }
	public string? ClassIndex { get; set; }
	public string? RaceName { get; set; }
	public string? ClassName { get; set; }
	public int Level { get; set; } = 1;
	public int MaxHitPoints { get; set; }
	public int CurrentHitPoints { get; set; }
	public int ArmorClass { get; set; } = 10;
	public int ProficiencyBonus { get; set; } = 2;
	public int Strength { get; set; } = 10;
	public int Dexterity { get; set; } = 10;
	public int Constitution { get; set; } = 10;
	public int Intelligence { get; set; } = 10;
	public int Wisdom { get; set; } = 10;
	public int Charisma { get; set; } = 10;
	public string? Background { get; set; }
	public string? Notes { get; set; }
	public List<string>? Skills { get; set; }
}
