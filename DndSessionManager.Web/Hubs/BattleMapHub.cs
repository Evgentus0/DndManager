using DndSessionManager.Web.Models;
using DndSessionManager.Web.Services;
using Microsoft.AspNetCore.SignalR;

namespace DndSessionManager.Web.Hubs;

public class BattleMapHub : Hub
{
	private readonly BattleMapService _mapService;
	private readonly UserService _userService;
	private readonly SessionService _sessionService;
	private readonly CharacterService _characterService;

	public BattleMapHub(
		BattleMapService mapService,
		UserService userService,
		SessionService sessionService,
		CharacterService characterService)
	{
		_mapService = mapService;
		_userService = userService;
		_sessionService = sessionService;
		_characterService = characterService;
	}

	// === Connection Management ===

	public async Task JoinBattleMap(string sessionId, string userId)
	{
		if (!Guid.TryParse(sessionId, out var sessionGuid) ||
			!Guid.TryParse(userId, out var userGuid))
			return;

		var session = _sessionService.GetSession(sessionGuid);
		if (session == null)
			return;

		// Update connection ID
		_userService.UpdateConnectionId(sessionGuid, userGuid, Context.ConnectionId);

		// Join SignalR group
		await Groups.AddToGroupAsync(Context.ConnectionId, $"battlemap_{sessionId}");

		// Load map into memory if not already
		_mapService.LoadBattleMapIntoMemory(sessionGuid);

		// Send initial state
		var map = _mapService.GetBattleMapBySession(sessionGuid);
		if (map != null)
		{
			var isMaster = _userService.IsUserMaster(sessionGuid, userGuid);
			var filteredMap = FilterMapForUser(map, isMaster);

			await Clients.Caller.SendAsync("InitialBattleMapState", new
			{
				map = filteredMap,
				version = map.Version
			});

			// Auto-create player token if not master and no token exists yet
			if (!isMaster)
			{
				var existingToken = map.Tokens.FirstOrDefault(t =>
					t.OwnerId.HasValue && t.OwnerId.Value == userGuid);

				if (existingToken == null)
				{
					var token = CreatePlayerToken(sessionGuid, userGuid);
					if (_mapService.AddToken(map.Id, token))
					{
						await Clients.Group($"battlemap_{sessionId}").SendAsync("TokenAdded", new
						{
							token = MapTokenToDto(token),
							version = map.Version
						});
					}
				}
			}
		}
	}

	public async Task LeaveBattleMap(string sessionId, string userId)
	{
		await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"battlemap_{sessionId}");
	}

	// === Token Operations ===

	public async Task MoveToken(string sessionId, string userId, string tokenId, int newX, int newY)
	{
		if (!Guid.TryParse(sessionId, out var sessionGuid) ||
			!Guid.TryParse(userId, out var userGuid) ||
			!Guid.TryParse(tokenId, out var tokenGuid))
			return;

		var map = _mapService.GetBattleMapBySession(sessionGuid);
		if (map == null)
			return;

		var token = map.Tokens.FirstOrDefault(t => t.Id == tokenGuid);
		if (token == null)
			return;

		var isMaster = _userService.IsUserMaster(sessionGuid, userGuid);
		if (!_mapService.CanUserMoveToken(token, userGuid, isMaster))
		{
			await Clients.Caller.SendAsync("BattleMapError", "You cannot move this token.");
			return;
		}

		// Update position
		if (_mapService.UpdateTokenPosition(map.Id, tokenGuid, newX, newY))
		{
			// Broadcast update to all clients
			await Clients.Group($"battlemap_{sessionId}").SendAsync("TokenMoved", new
			{
				tokenId = tokenId,
				x = newX,
				y = newY,
				version = map.Version
			});
		}
	}

	public async Task AddToken(string sessionId, string userId, BattleTokenDto tokenData)
	{
		if (!Guid.TryParse(sessionId, out var sessionGuid) ||
			!Guid.TryParse(userId, out var userGuid))
			return;

		var isMaster = _userService.IsUserMaster(sessionGuid, userGuid);
		if (!_mapService.CanUserEditMap(isMaster))
		{
			await Clients.Caller.SendAsync("BattleMapError", "Only the DM can add tokens.");
			return;
		}

		var map = _mapService.GetBattleMapBySession(sessionGuid);
		if (map == null)
			return;

		var token = new BattleToken
		{
			CharacterId = string.IsNullOrEmpty(tokenData.CharacterId)
				? null
				: Guid.Parse(tokenData.CharacterId),
			Name = tokenData.Name,
			X = tokenData.X,
			Y = tokenData.Y,
			Size = tokenData.Size,
			Color = tokenData.Color,
			ImageUrl = tokenData.ImageUrl,
			IconName = tokenData.IconName,
			IsVisible = tokenData.IsVisible,
			IsDmOnly = tokenData.IsDmOnly,
			OwnerId = string.IsNullOrEmpty(tokenData.OwnerId)
				? null
				: Guid.Parse(tokenData.OwnerId)
		};

		if (_mapService.AddToken(map.Id, token))
		{
			await Clients.Group($"battlemap_{sessionId}").SendAsync("TokenAdded", new
			{
				token = MapTokenToDto(token),
				version = map.Version
			});
		}
	}

	public async Task RemoveToken(string sessionId, string userId, string tokenId)
	{
		if (!Guid.TryParse(sessionId, out var sessionGuid) ||
			!Guid.TryParse(userId, out var userGuid) ||
			!Guid.TryParse(tokenId, out var tokenGuid))
			return;

		var isMaster = _userService.IsUserMaster(sessionGuid, userGuid);
		if (!_mapService.CanUserEditMap(isMaster))
		{
			await Clients.Caller.SendAsync("BattleMapError", "Only the DM can remove tokens.");
			return;
		}

		var map = _mapService.GetBattleMapBySession(sessionGuid);
		if (map == null)
			return;

		if (_mapService.RemoveToken(map.Id, tokenGuid))
		{
			await Clients.Group($"battlemap_{sessionId}").SendAsync("TokenRemoved", new
			{
				tokenId = tokenId,
				version = map.Version
			});
		}
	}

	public async Task UpdateToken(string sessionId, string userId, string tokenId, BattleTokenUpdateDto updates)
	{
		if (!Guid.TryParse(sessionId, out var sessionGuid) ||
			!Guid.TryParse(userId, out var userGuid) ||
			!Guid.TryParse(tokenId, out var tokenGuid))
			return;

		var isMaster = _userService.IsUserMaster(sessionGuid, userGuid);
		var map = _mapService.GetBattleMapBySession(sessionGuid);
		if (map == null)
			return;
		var token = map.Tokens.FirstOrDefault(t => t.Id == tokenGuid);
		if (token == null)
			return;
		if(!_mapService.CanUserEditToken(token, userGuid, isMaster))
		{
			await Clients.Caller.SendAsync("BattleMapError", "Changes not allowed.");
			return;
		}

		if (_mapService.UpdateToken(map, token, updates))
		{
			await Clients.Group($"battlemap_{sessionId}").SendAsync("TokenUpdated", new
			{
				tokenId = tokenId,
				token = MapTokenToDto(token),
				version = map.Version
			});
		}
	}

	// === Wall Operations ===

	public async Task AddWall(string sessionId, string userId, WallDto wallData)
	{
		if (!Guid.TryParse(sessionId, out var sessionGuid) ||
			!Guid.TryParse(userId, out var userGuid))
			return;

		var isMaster = _userService.IsUserMaster(sessionGuid, userGuid);
		if (!_mapService.CanUserEditMap(isMaster))
		{
			await Clients.Caller.SendAsync("BattleMapError", "Only the DM can add walls.");
			return;
		}

		var map = _mapService.GetBattleMapBySession(sessionGuid);
		if (map == null)
			return;

		var wall = new Wall
		{
			X1 = wallData.X1,
			Y1 = wallData.Y1,
			X2 = wallData.X2,
			Y2 = wallData.Y2,
			Type = Enum.Parse<WallType>(wallData.Type),
			BlocksLight = wallData.BlocksLight,
			BlocksMovement = wallData.BlocksMovement
		};

		if (_mapService.AddWall(map.Id, wall))
		{
			await Clients.Group($"battlemap_{sessionId}").SendAsync("WallAdded", new
			{
				wall = MapWallToDto(wall),
				version = map.Version
			});
		}
	}

	public async Task RemoveWall(string sessionId, string userId, string wallId)
	{
		if (!Guid.TryParse(sessionId, out var sessionGuid) ||
			!Guid.TryParse(userId, out var userGuid) ||
			!Guid.TryParse(wallId, out var wallGuid))
			return;

		var isMaster = _userService.IsUserMaster(sessionGuid, userGuid);
		if (!_mapService.CanUserEditMap(isMaster))
		{
			await Clients.Caller.SendAsync("BattleMapError", "Only the DM can remove walls.");
			return;
		}

		var map = _mapService.GetBattleMapBySession(sessionGuid);
		if (map == null)
			return;

		if (_mapService.RemoveWall(map.Id, wallGuid))
		{
			await Clients.Group($"battlemap_{sessionId}").SendAsync("WallRemoved", new
			{
				wallId = wallId,
				version = map.Version
			});
		}
	}

	// === Fog of War ===

	public async Task RevealArea(string sessionId, string userId, List<GridCellDto> cells)
	{
		if (!Guid.TryParse(sessionId, out var sessionGuid) ||
			!Guid.TryParse(userId, out var userGuid))
			return;

		var isMaster = _userService.IsUserMaster(sessionGuid, userGuid);
		if (!_mapService.CanUserEditMap(isMaster))
		{
			await Clients.Caller.SendAsync("BattleMapError", "Only the DM can reveal areas.");
			return;
		}

		var map = _mapService.GetBattleMapBySession(sessionGuid);
		if (map == null)
			return;

		var gridCells = cells.Select(c => new GridCell { X = c.X, Y = c.Y }).ToList();

		if (_mapService.RevealCells(map.Id, gridCells))
		{
			await Clients.Group($"battlemap_{sessionId}").SendAsync("FogOfWarUpdated", new
			{
				revealedCells = cells,
				version = map.Version
			});
		}
	}

	public async Task ShroudArea(string sessionId, string userId, List<GridCellDto> cells)
	{
		if (!Guid.TryParse(sessionId, out var sessionGuid) ||
			!Guid.TryParse(userId, out var userGuid))
			return;

		var isMaster = _userService.IsUserMaster(sessionGuid, userGuid);
		if (!_mapService.CanUserEditMap(isMaster))
		{
			await Clients.Caller.SendAsync("BattleMapError", "Only the DM can shroud areas.");
			return;
		}

		var map = _mapService.GetBattleMapBySession(sessionGuid);
		if (map == null)
			return;

		var gridCells = cells.Select(c => new GridCell { X = c.X, Y = c.Y }).ToList();

		if (_mapService.ShroudCells(map.Id, gridCells))
		{
			await Clients.Group($"battlemap_{sessionId}").SendAsync("FogOfWarUpdated", new
			{
				revealedCells = map.FogOfWar.RevealedCells.Select(c => new { c.X, c.Y }),
				version = map.Version
			});
		}
	}

	public async Task ToggleFog(string sessionId, string userId, bool enabled)
	{
		if (!Guid.TryParse(sessionId, out var sessionGuid) ||
			!Guid.TryParse(userId, out var userGuid))
			return;

		var isMaster = _userService.IsUserMaster(sessionGuid, userGuid);
		if (!_mapService.CanUserEditMap(isMaster))
		{
			await Clients.Caller.SendAsync("BattleMapError", "Only the DM can toggle fog.");
			return;
		}

		if (_mapService.SetFogEnabled(sessionGuid, enabled))
		{
			var map = _mapService.GetBattleMapBySession(sessionGuid);
			await Clients.Group($"battlemap_{sessionId}").SendAsync("FogEnabledChanged", new
			{
				enabled = enabled,
				version = map.Version
			});
		}
	}

	// === Background Operations ===

	public async Task UpdateBackground(string sessionId, string userId, BackgroundDto backgroundData)
	{
		if (!Guid.TryParse(sessionId, out var sessionGuid) ||
			!Guid.TryParse(userId, out var userGuid))
			return;

		var isMaster = _userService.IsUserMaster(sessionGuid, userGuid);
		if (!_mapService.CanUserEditMap(isMaster))
		{
			await Clients.Caller.SendAsync("BattleMapError", "Only the DM can update the background.");
			return;
		}

		var map = _mapService.GetBattleMapBySession(sessionGuid);
		if (map == null)
			return;

		if (_mapService.UpdateBackgroundImage(map.Id, backgroundData.ImageUrl, backgroundData.Scale, backgroundData.OffsetX, backgroundData.OffsetY))
		{
			await Clients.Group($"battlemap_{sessionId}").SendAsync("BackgroundUpdated", new
			{
				imageUrl = backgroundData.ImageUrl,
				scale = backgroundData.Scale,
				offsetX = backgroundData.OffsetX,
				offsetY = backgroundData.OffsetY,
				version = map.Version
			});
		}
	}

	// === Grid Operations ===

	public async Task UpdateGridSize(string sessionId, string userId, int newWidth, int newHeight)
	{
		if (!Guid.TryParse(sessionId, out var sessionGuid) ||
			!Guid.TryParse(userId, out var userGuid))
			return;

		var isMaster = _userService.IsUserMaster(sessionGuid, userGuid);
		if (!_mapService.CanUserEditMap(isMaster))
		{
			await Clients.Caller.SendAsync("BattleMapError", "Only the DM can update grid size.");
			return;
		}

		var map = _mapService.GetBattleMapBySession(sessionGuid);
		if (map == null)
			return;

		// Validate dimensions
		if (newWidth < 5 || newWidth > 100 || newHeight < 5 || newHeight > 100)
		{
			await Clients.Caller.SendAsync("BattleMapError", "Grid dimensions must be between 5 and 100.");
			return;
		}

		var (success, movedTokens) = _mapService.UpdateGridDimensions(map.Id, newWidth, newHeight);
		if (success)
		{
			await Clients.Group($"battlemap_{sessionId}").SendAsync("GridSizeUpdated", new
			{
				width = newWidth,
				height = newHeight,
				movedTokens = movedTokens.Select(t => new
				{
					id = t.TokenId.ToString(),
					oldX = t.OldX,
					oldY = t.OldY,
					newX = t.NewX,
					newY = t.NewY
				}).ToList(),
				version = map.Version
			});
		}
	}

	public async Task UpdateGridColor(string sessionId, string userId, string newColor)
	{
		if (!Guid.TryParse(sessionId, out var sessionGuid) ||
			!Guid.TryParse(userId, out var userGuid))
			return;

		var isMaster = _userService.IsUserMaster(sessionGuid, userGuid);
		if (!_mapService.CanUserEditMap(isMaster))
		{
			await Clients.Caller.SendAsync("BattleMapError", "Only the DM can update grid color.");
			return;
		}

		var map = _mapService.GetBattleMapBySession(sessionGuid);
		if (map == null)
			return;

		if (_mapService.UpdateGridColor(map.Id, newColor))
		{
			await Clients.Group($"battlemap_{sessionId}").SendAsync("GridColorUpdated", new
			{
				color = newColor,
				version = map.Version
			});
		}
	}

	public async Task UpdateGridWidth(string sessionId, string userId, int newGridWidth)
	{
		if (!Guid.TryParse(sessionId, out var sessionGuid) ||
			!Guid.TryParse(userId, out var userGuid))
			return;

		var isMaster = _userService.IsUserMaster(sessionGuid, userGuid);
		if (!_mapService.CanUserEditMap(isMaster))
		{
			await Clients.Caller.SendAsync("BattleMapError", "Only the DM can update grid color.");
			return;
		}

		if (newGridWidth < 1 || newGridWidth > 10)
		{
			await Clients.Caller.SendAsync("BattleMapError", "Grid width must be between 1 and 10.");
			return;
		}

		var map = _mapService.GetBattleMapBySession(sessionGuid);
		if (map == null)
			return;

		if (_mapService.UpdateGridWidth(map.Id, newGridWidth))
		{
			await Clients.Group($"battlemap_{sessionId}").SendAsync("GridWidthUpdated", new
			{
				gridWidth = newGridWidth,
				version = map.Version
			});
		}
	}

	// === Persistence ===

	public async Task SaveBattleMap(string sessionId, string userId)
	{
		if (!Guid.TryParse(sessionId, out var sessionGuid) ||
			!Guid.TryParse(userId, out var userGuid))
			return;

		var isMaster = _userService.IsUserMaster(sessionGuid, userGuid);
		if (!isMaster)
			return;

		var map = _mapService.GetBattleMapBySession(sessionGuid);
		if (map != null)
		{
			_mapService.SaveAndDeactivateBattleMap(map.Id);
			await Clients.Caller.SendAsync("BattleMapSaved");
		}
	}

	// === Helper Methods ===

	private object FilterMapForUser(BattleMap map, bool isMaster)
	{
		return new
		{
			id = map.Id.ToString(),
			sessionId = map.SessionId.ToString(),
			version = map.Version,
			grid = map.Grid,
			tokens = map.Tokens
				.Where(t => isMaster || !t.IsDmOnly)
				.Select(MapTokenToDto)
				.ToList(),
			walls = map.Walls.Select(MapWallToDto).ToList(),
			fogOfWar = new
			{
				enabled = map.FogOfWar.Enabled,
				revealedCells = map.FogOfWar.RevealedCells
			},
			background = map.Background
		};
	}

	private object MapTokenToDto(BattleToken t) => new
	{
		id = t.Id.ToString(),
		characterId = t.CharacterId?.ToString(),
		name = t.Name,
		x = t.X,
		y = t.Y,
		size = t.Size,
		color = t.Color,
		imageUrl = t.ImageUrl,
		iconName = t.IconName,
		isVisible = t.IsVisible,
		isDmOnly = t.IsDmOnly,
		ownerId = t.OwnerId?.ToString(),
		order = t.Order
	};

	private object MapWallToDto(Wall w) => new
	{
		id = w.Id.ToString(),
		x1 = w.X1,
		y1 = w.Y1,
		x2 = w.X2,
		y2 = w.Y2,
		type = w.Type.ToString(),
		blocksLight = w.BlocksLight,
		blocksMovement = w.BlocksMovement
	};

	private BattleToken CreatePlayerToken(Guid sessionId, Guid userId)
	{
		var user = _userService.GetUser(sessionId, userId);
		string tokenName = user?.Username ?? "Player";
		Guid? characterId = null;

		if (user != null)
		{
			var character = _characterService.GetCharacterByOwner(sessionId, userId);
			if (character != null)
			{
				tokenName = character.Name;
				characterId = character.Id;
			}
		}

		var colorIndex = Math.Abs(userId.GetHashCode()) % _playerColors.Length;

		return new BattleToken
		{
			Name = tokenName,
			OwnerId = userId,
			CharacterId = characterId,
			X = 1,
			Y = 1,
			Size = 1,
			Color = _playerColors[colorIndex],
			IsVisible = true,
			IsDmOnly = false
		};
	}

	private static readonly string[] _playerColors =
	[
		"#e74c3c", "#2ecc71", "#3498db", "#9b59b6",
		"#f39c12", "#1abc9c", "#e67e22", "#34495e"
	];
}

// DTOs
public class BattleTokenDto
{
	public string? CharacterId { get; set; }
	public string Name { get; set; } = string.Empty;
	public int X { get; set; }
	public int Y { get; set; }
	public int Size { get; set; } = 1;
	public string Color { get; set; } = "#3498db";
	public string? ImageUrl { get; set; }
	public string? IconName { get; set; }
	public bool IsVisible { get; set; } = true;
	public bool IsDmOnly { get; set; } = false;
	public string? OwnerId { get; set; }
}

public class WallDto
{
	public int X1 { get; set; }
	public int Y1 { get; set; }
	public int X2 { get; set; }
	public int Y2 { get; set; }
	public string Type { get; set; } = "Solid";
	public bool BlocksLight { get; set; } = true;
	public bool BlocksMovement { get; set; } = true;
}

public class GridCellDto
{
	public int X { get; set; }
	public int Y { get; set; }
}

public class BackgroundDto
{
	public string? ImageUrl { get; set; }
	public double Scale { get; set; } = 1.0;
	public int OffsetX { get; set; } = 0;
	public int OffsetY { get; set; } = 0;
}

public class BattleTokenUpdateDto
{
	public string? Name { get; set; }
	public string? Color { get; set; }
	public string? ImageUrl { get; set; }
	public int? Size { get; set; }
	public bool? IsVisible { get; set; }
	public bool? IsDmOnly { get; set; }
}
