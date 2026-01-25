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

		var isMaster = _userService.IsUserMaster(sessionGuid, userGuid);
		// Check if user already has a character and user not master
		if (_characterService.HasCharacter(sessionGuid, userGuid) && !isMaster)
		{
			await Clients.Caller.SendAsync("CharacterError", "You already have a character in this session.");
			return;
		}

		// Validate password
		if (string.IsNullOrWhiteSpace(characterData.Password) || characterData.Password.Length < 4)
		{
			await Clients.Caller.SendAsync("CharacterError", "Character password is required (minimum 4 characters).");
			return;
		}

		var character = new Character
		{
			SessionId = sessionGuid,
			OwnerId = isMaster ? null : userGuid,
			OwnerUsername = user.Username,
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
			Skills = characterData.Skills ?? [],
			Equipment = MapEquipmentDtoToModel(characterData.Equipment),
			Spells = MapSpellsDtoToModel(characterData.Spells),
			SpellSlots = MapSpellSlotsDtoToModel(characterData.SpellSlots),
			Features = MapFeaturesDtoToModel(characterData.Features),
			Traits = MapTraitsDtoToModel(characterData.Traits)
		};

		_characterService.CreateCharacter(character, characterData.Password);

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
		existingCharacter.Equipment = MapEquipmentDtoToModel(characterData.Equipment);
		existingCharacter.Spells = MapSpellsDtoToModel(characterData.Spells);
		existingCharacter.SpellSlots = MapSpellSlotsDtoToModel(characterData.SpellSlots);
		existingCharacter.Features = MapFeaturesDtoToModel(characterData.Features);
		existingCharacter.Traits = MapTraitsDtoToModel(characterData.Traits);

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

	public async Task ResetCharacterPassword(string sessionId, string masterUserId, string characterId)
	{
		if (!Guid.TryParse(sessionId, out var sessionGuid) ||
			!Guid.TryParse(masterUserId, out var masterUserGuid) ||
			!Guid.TryParse(characterId, out var characterGuid))
			return;

		// Verify the requester is the master
		if (!_userService.IsUserMaster(sessionGuid, masterUserGuid))
		{
			await Clients.Caller.SendAsync("CharacterError", "Only the Game Master can reset character passwords.");
			return;
		}

		var character = _characterService.GetCharacter(characterGuid);
		if (character == null || character.SessionId != sessionGuid)
		{
			await Clients.Caller.SendAsync("CharacterError", "Character not found.");
			return;
		}

		// Check if character is currently owned by someone online
		var session = _sessionService.GetSession(sessionGuid);
		if (session != null && character.OwnerId.HasValue)
		{
			var currentOwner = session.Users.FirstOrDefault(u => u.Id == character.OwnerId.Value);
			if (currentOwner != null)
			{
				await Clients.Caller.SendAsync("CharacterError", "Cannot reset password for a character that is currently being played.");
				return;
			}
		}

		// Reset the password
		_characterService.ResetCharacterPassword(characterGuid);

		// Notify all clients about the update
		var updatedCharacter = _characterService.GetCharacter(characterGuid);
		if (updatedCharacter != null)
		{
			await Clients.Group(sessionId).SendAsync("CharacterUpdated", MapCharacterToDto(updatedCharacter));
		}
	}

	public async Task UpdateEquipmentAmmo(string sessionId, string userId, string characterId, string equipmentItemId, int newAmmoCount)
	{
		if (!Guid.TryParse(sessionId, out var sessionGuid) ||
			!Guid.TryParse(userId, out var userGuid) ||
			!Guid.TryParse(characterId, out var characterGuid) ||
			!Guid.TryParse(equipmentItemId, out var itemGuid))
			return;

		var user = _userService.GetUser(sessionGuid, userGuid);
		if (user == null)
			return;

		var character = _characterService.GetCharacter(characterGuid);
		if (character == null || character.SessionId != sessionGuid)
			return;

		var isMaster = _userService.IsUserMaster(sessionGuid, userGuid);
		if (!_characterService.CanUserEditCharacter(userGuid, character, isMaster))
		{
			await Clients.Caller.SendAsync("CharacterError", "You cannot edit this character.");
			return;
		}

		var equipmentItem = character.Equipment.FirstOrDefault(e => e.Id == itemGuid);
		if (equipmentItem == null || equipmentItem.CurrentAmmo == null)
			return;

		equipmentItem.CurrentAmmo = Math.Max(0, newAmmoCount);
		_characterService.UpdateCharacter(character);

		await Clients.Group(sessionId).SendAsync("CharacterEquipmentUpdated", new
		{
			CharacterId = characterId,
			Equipment = character.Equipment.Select(MapEquipmentItemToDto).ToList()
		});
	}

	public async Task UseSpellSlot(string sessionId, string userId, string characterId, int spellLevel, int newUsedCount)
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
		if (!_characterService.CanUserEditCharacter(userGuid, character, isMaster))
		{
			await Clients.Caller.SendAsync("CharacterError", "You cannot edit this character.");
			return;
		}

		var slot = character.SpellSlots.FirstOrDefault(s => s.Level == spellLevel);
		if (slot == null)
			return;

		slot.Used = Math.Clamp(newUsedCount, 0, slot.Total);
		_characterService.UpdateCharacter(character);

		await Clients.Group(sessionId).SendAsync("CharacterSpellSlotsUpdated", new
		{
			CharacterId = characterId,
			SpellSlots = character.SpellSlots.Select(MapSpellSlotToDto).ToList()
		});
	}

	private static object MapCharacterToDto(Character c) => new
	{
		Id = c.Id.ToString(),
		OwnerId = c.OwnerId?.ToString(),
		c.OwnerUsername,
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
		c.Skills,
		Equipment = c.Equipment.Select(MapEquipmentItemToDto).ToList(),
		Spells = c.Spells.Select(MapSpellItemToDto).ToList(),
		SpellSlots = c.SpellSlots.Select(MapSpellSlotToDto).ToList(),
		Features = c.Features.Select(MapFeatureItemToDto).ToList(),
		Traits = c.Traits.Select(MapTraitItemToDto).ToList(),
		IsClaimed = !string.IsNullOrEmpty(c.PasswordHash)
	};

	private static object MapEquipmentItemToDto(CharacterEquipmentItem e) => new
	{
		Id = e.Id.ToString(),
		e.EquipmentIndex,
		e.EquipmentName,
		e.Quantity,
		e.CurrentAmmo,
		e.IsEquipped
	};

	private static List<CharacterEquipmentItem> MapEquipmentDtoToModel(List<CharacterEquipmentItemDto>? equipmentDto)
	{
		if (equipmentDto == null || equipmentDto.Count == 0)
			return [];

		return equipmentDto.Select(e => new CharacterEquipmentItem
		{
			Id = Guid.TryParse(e.Id, out var id) ? id : Guid.NewGuid(),
			EquipmentIndex = e.EquipmentIndex,
			EquipmentName = e.EquipmentName,
			Quantity = e.Quantity,
			CurrentAmmo = e.CurrentAmmo,
			IsEquipped = e.IsEquipped
		}).ToList();
	}

	private static object MapSpellItemToDto(CharacterSpellItem s) => new
	{
		Id = s.Id.ToString(),
		s.SpellIndex,
		s.SpellName,
		s.Level,
		s.IsPrepared
	};

	private static object MapSpellSlotToDto(CharacterSpellSlot s) => new
	{
		s.Level,
		s.Total,
		s.Used
	};

	private static List<CharacterSpellItem> MapSpellsDtoToModel(List<CharacterSpellItemDto>? spellsDto)
	{
		if (spellsDto == null || spellsDto.Count == 0)
			return [];

		return spellsDto.Select(s => new CharacterSpellItem
		{
			Id = Guid.TryParse(s.Id, out var id) ? id : Guid.NewGuid(),
			SpellIndex = s.SpellIndex,
			SpellName = s.SpellName,
			Level = s.Level,
			IsPrepared = s.IsPrepared
		}).ToList();
	}

	private static List<CharacterSpellSlot> MapSpellSlotsDtoToModel(List<CharacterSpellSlotDto>? slotsDto)
	{
		if (slotsDto == null || slotsDto.Count == 0)
			return [];

		return slotsDto.Select(s => new CharacterSpellSlot
		{
			Level = s.Level,
			Total = s.Total,
			Used = s.Used
		}).ToList();
	}

	private static object MapFeatureItemToDto(CharacterFeatureItem f) => new
	{
		Id = f.Id.ToString(),
		f.FeatureIndex,
		f.FeatureName,
		f.Level
	};

	private static List<CharacterFeatureItem> MapFeaturesDtoToModel(List<CharacterFeatureItemDto>? featuresDto)
	{
		if (featuresDto == null || featuresDto.Count == 0)
			return [];

		return featuresDto.Select(f => new CharacterFeatureItem
		{
			Id = Guid.TryParse(f.Id, out var id) ? id : Guid.NewGuid(),
			FeatureIndex = f.FeatureIndex,
			FeatureName = f.FeatureName,
			Level = f.Level
		}).ToList();
	}

	private static object MapTraitItemToDto(CharacterTraitItem t) => new
	{
		Id = t.Id.ToString(),
		t.TraitIndex,
		t.TraitName
	};

	private static List<CharacterTraitItem> MapTraitsDtoToModel(List<CharacterTraitItemDto>? traitsDto)
	{
		if (traitsDto == null || traitsDto.Count == 0)
			return [];

		return traitsDto.Select(t => new CharacterTraitItem
		{
			Id = Guid.TryParse(t.Id, out var id) ? id : Guid.NewGuid(),
			TraitIndex = t.TraitIndex,
			TraitName = t.TraitName
		}).ToList();
	}
}

public class CharacterDto
{
	public string? Id { get; set; }
	public string Name { get; set; } = string.Empty;
	public string? Password { get; set; }
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
	public List<CharacterEquipmentItemDto>? Equipment { get; set; }
	public List<CharacterSpellItemDto>? Spells { get; set; }
	public List<CharacterSpellSlotDto>? SpellSlots { get; set; }
	public List<CharacterFeatureItemDto>? Features { get; set; }
	public List<CharacterTraitItemDto>? Traits { get; set; }
}

public class CharacterEquipmentItemDto
{
	public string? Id { get; set; }
	public string EquipmentIndex { get; set; } = string.Empty;
	public string EquipmentName { get; set; } = string.Empty;
	public int Quantity { get; set; } = 1;
	public int? CurrentAmmo { get; set; }
	public bool IsEquipped { get; set; } = true;
}

public class CharacterSpellItemDto
{
	public string? Id { get; set; }
	public string SpellIndex { get; set; } = string.Empty;
	public string SpellName { get; set; } = string.Empty;
	public int Level { get; set; }
	public bool IsPrepared { get; set; } = true;
}

public class CharacterSpellSlotDto
{
	public int Level { get; set; }
	public int Total { get; set; }
	public int Used { get; set; }
}

public class CharacterFeatureItemDto
{
	public string? Id { get; set; }
	public string FeatureIndex { get; set; } = string.Empty;
	public string FeatureName { get; set; } = string.Empty;
	public int Level { get; set; }
}

public class CharacterTraitItemDto
{
	public string? Id { get; set; }
	public string TraitIndex { get; set; } = string.Empty;
	public string TraitName { get; set; } = string.Empty;
}
