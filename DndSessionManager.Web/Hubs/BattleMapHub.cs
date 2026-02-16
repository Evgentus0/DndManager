using DndSessionManager.Web.Models;
using DndSessionManager.Web.Persistence;
using DndSessionManager.Web.Services;
using Microsoft.AspNetCore.SignalR;

namespace DndSessionManager.Web.Hubs;

public class BattleMapHub : Hub
{
	private readonly BattleMapService _mapService;
	private readonly UserService _userService;
	private readonly SessionService _sessionService;
	private readonly CharacterService _characterService;
	private readonly ISessionRepository _repository;

	public BattleMapHub(
		BattleMapService mapService,
		UserService userService,
		SessionService sessionService,
		CharacterService characterService,
		ISessionRepository repository)
	{
		_mapService = mapService;
		_userService = userService;
		_sessionService = sessionService;
		_characterService = characterService;
		_repository = repository;
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
		var map = _mapService.GetActiveMap(sessionGuid);
		if (map != null)
		{
			var isMaster = _userService.IsUserMaster(sessionGuid, userGuid);
			var filteredMap = FilterMapForUser(map, isMaster);

			await Clients.Caller.SendAsync("InitialBattleMapState", new
			{
				map = filteredMap,
				version = map.Version
			});

			// Auto-create/restore player token if not master
			if (!isMaster)
			{
				var character = _characterService.GetCharacterByOwner(sessionGuid, userGuid);
				if (character != null)
				{
					// Check if character's token already exists on map (prevent duplicates)
					var existingToken = map.Tokens.FirstOrDefault(t => t.CharacterId == character.Id);

					if (existingToken == null)
					{
						var token = CreateOrRestorePlayerToken(sessionGuid, userGuid, map.Id);
						if (token != null && _mapService.AddToken(map.Id, token))
						{
							await Clients.Group($"battlemap_{sessionId}").SendAsync("TokenAdded", new
							{
								token = MapTokenToDto(token),
								version = map.Version
							});
						}
					}
					else
					{
						// Character already on map - could send a message or silently ignore
						// For now, silently ignore (user might have multiple browser tabs open)
					}
				}
			}
		}
	}

	public async Task LeaveBattleMap(string sessionId, string userId)
	{
		if (!Guid.TryParse(sessionId, out var sessionGuid) ||
			!Guid.TryParse(userId, out var userGuid))
		{
			await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"battlemap_{sessionId}");
			return;
		}

		var character = _characterService.GetCharacterByOwner(sessionGuid, userGuid);
		if (character != null)
		{
			var map = _mapService.GetActiveMap(sessionGuid);
			if (map != null)
			{
				// Find token by CharacterId
				var playerToken = map.Tokens.FirstOrDefault(t => t.CharacterId == character.Id);

				if (playerToken != null)
				{
					// Save FULL token state to PersistedToken
					var persistedToken = _repository.GetPersistedToken(sessionGuid, character.Id);
					if (persistedToken != null)
					{
						persistedToken.X = playerToken.X;
						persistedToken.Y = playerToken.Y;
						persistedToken.MapId = map.Id;
						persistedToken.Name = playerToken.Name;
						persistedToken.Color = playerToken.Color;
						persistedToken.Size = playerToken.Size;
						persistedToken.ImageUrl = playerToken.ImageUrl;
						persistedToken.IconName = playerToken.IconName;
					}
					else
					{
						persistedToken = new PersistedToken
						{
							Id = playerToken.Id,
							SessionId = sessionGuid,
							CharacterId = character.Id,
							MapId = map.Id,
							Name = playerToken.Name,
							X = playerToken.X,
							Y = playerToken.Y,
							Size = playerToken.Size,
							Color = playerToken.Color,
							ImageUrl = playerToken.ImageUrl,
							IconName = playerToken.IconName
						};
					}
					_repository.SavePersistedToken(persistedToken);

					// Also save to TokenPositionHistory (for audit trail)
					_mapService.SaveTokenPosition(new TokenPositionHistory
					{
						SessionId = sessionGuid,
						CharacterId = character.Id,
						UserId = userGuid, // for backward compatibility
						MapId = map.Id,
						X = playerToken.X,
						Y = playerToken.Y
					});

					// Remove token from map
					if (_mapService.RemoveToken(map.Id, playerToken.Id))
					{
						await Clients.Group($"battlemap_{sessionId}").SendAsync("TokenRemoved", new
						{
							tokenId = playerToken.Id.ToString(),
							version = map.Version
						});
					}
				}
			}
		}

		// Unsubscribe from SignalR group
		await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"battlemap_{sessionId}");
	}

	// === Token Operations ===

	public async Task MoveToken(string sessionId, string userId, string tokenId, int newX, int newY)
	{
		if (!Guid.TryParse(sessionId, out var sessionGuid) ||
			!Guid.TryParse(userId, out var userGuid) ||
			!Guid.TryParse(tokenId, out var tokenGuid))
			return;

		var map = _mapService.GetActiveMap(sessionGuid);
		if (map == null)
			return;

		var token = map.Tokens.FirstOrDefault(t => t.Id == tokenGuid);
		if (token == null)
			return;

		var isMaster = _userService.IsUserMaster(sessionGuid, userGuid);
		if (!_mapService.CanUserMoveToken(token, userGuid, sessionGuid, isMaster))
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

		var map = _mapService.GetActiveMap(sessionGuid);
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
				: Guid.Parse(tokenData.OwnerId),
			Initiative = tokenData.Initiative
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

		var map = _mapService.GetActiveMap(sessionGuid);
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
		var map = _mapService.GetActiveMap(sessionGuid);
		if (map == null)
			return;
		var token = map.Tokens.FirstOrDefault(t => t.Id == tokenGuid);
		if (token == null)
			return;
		if(!_mapService.CanUserEditToken(token, userGuid, sessionGuid, isMaster))
		{
			await Clients.Caller.SendAsync("BattleMapError", "Changes not allowed.");
			return;
		}

		if (_mapService.UpdateToken(map, token, updates))
		{
			// Save visual property changes to PersistedToken
			if (token.CharacterId.HasValue)
			{
				var persistedToken = _repository.GetPersistedToken(sessionGuid, token.CharacterId.Value);
				if (persistedToken != null)
				{
					persistedToken.Name = token.Name;
					persistedToken.Color = token.Color;
					persistedToken.Size = token.Size;
					persistedToken.ImageUrl = token.ImageUrl;
					persistedToken.IconName = token.IconName;
					_repository.SavePersistedToken(persistedToken);
				}
			}

			await Clients.Group($"battlemap_{sessionId}").SendAsync("TokenUpdated", new
			{
				tokenId = tokenId,
				token = MapTokenToDto(token),
				version = map.Version
			});
		}
	}

	public async Task UpdateTokenInitiative(string sessionId, string userId, string tokenId, int? initiative)
	{
		if (!Guid.TryParse(sessionId, out var sessionGuid) ||
			!Guid.TryParse(userId, out var userGuid) ||
			!Guid.TryParse(tokenId, out var tokenGuid))
			return;

		var isMaster = _userService.IsUserMaster(sessionGuid, userGuid);
		if (!_mapService.CanUserEditMap(isMaster))
		{
			await Clients.Caller.SendAsync("BattleMapError", "Only the DM can update initiative.");
			return;
		}

		var map = _mapService.GetActiveMap(sessionGuid);
		if (map == null)
			return;

		if (_mapService.UpdateTokenInitiative(map.Id, tokenGuid, initiative))
		{
			await Clients.Group($"battlemap_{sessionId}").SendAsync("TokenInitiativeUpdated", new
			{
				tokenId = tokenId,
				initiative = initiative,
				version = map.Version
			});
		}
	}

	public async Task SwapTokenInitiatives(string sessionId, string userId, string tokenId1, string tokenId2)
	{
		if (!Guid.TryParse(sessionId, out var sessionGuid) ||
			!Guid.TryParse(userId, out var userGuid) ||
			!Guid.TryParse(tokenId1, out var token1Guid) ||
			!Guid.TryParse(tokenId2, out var token2Guid))
			return;

		var isMaster = _userService.IsUserMaster(sessionGuid, userGuid);
		if (!_mapService.CanUserEditMap(isMaster))
		{
			await Clients.Caller.SendAsync("BattleMapError", "Only the DM can reorder initiative.");
			return;
		}

		var map = _mapService.GetActiveMap(sessionGuid);
		if (map == null)
			return;

		var token1 = map.Tokens.FirstOrDefault(t => t.Id == token1Guid);
		var token2 = map.Tokens.FirstOrDefault(t => t.Id == token2Guid);
		if (token1 == null || token2 == null)
			return;

		if (_mapService.SwapTokenInitiatives(map.Id, token1Guid, token2Guid))
		{
			await Clients.Group($"battlemap_{sessionId}").SendAsync("TokenInitiativesSwapped", new
			{
				tokenId1 = tokenId1,
				tokenId2 = tokenId2,
				initiative1 = token1.Initiative,
				initiative2 = token2.Initiative,
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

		var map = _mapService.GetActiveMap(sessionGuid);
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

		var map = _mapService.GetActiveMap(sessionGuid);
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

		var map = _mapService.GetActiveMap(sessionGuid);
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

		var map = _mapService.GetActiveMap(sessionGuid);
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
			var map = _mapService.GetActiveMap(sessionGuid);
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

		var map = _mapService.GetActiveMap(sessionGuid);
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

		var map = _mapService.GetActiveMap(sessionGuid);
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

		var map = _mapService.GetActiveMap(sessionGuid);
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

		var map = _mapService.GetActiveMap(sessionGuid);
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

		var map = _mapService.GetActiveMap(sessionGuid);
		if (map != null)
		{
			_mapService.SaveAndDeactivateBattleMap(map.Id);
			await Clients.Caller.SendAsync("BattleMapSaved");
		}
	}

	// === Map Management ===

	public async Task GetAllMaps(string sessionId)
	{
		if (!Guid.TryParse(sessionId, out var sessionGuid))
			return;

		var maps = _mapService.GetBattleMaps(sessionGuid);
		var mapDtos = maps.Select(m => new
		{
			id = m.Id.ToString(),
			name = m.Name,
			isActive = m.IsActive,
			displayOrder = m.DisplayOrder,
			tokenCount = m.Tokens.Count
		});

		await Clients.Caller.SendAsync("MapsList", mapDtos);
	}

	public async Task CreateMap(string sessionId, string userId, string mapName)
	{
		if (!Guid.TryParse(sessionId, out var sessionGuid) || !Guid.TryParse(userId, out var userGuid))
			return;

		var isMaster = _userService.IsUserMaster(sessionGuid, userGuid);
		if (!_mapService.CanUserEditMap(isMaster))
		{
			await Clients.Caller.SendAsync("BattleMapError", "Only the DM can create maps.");
			return;
		}

		var newMap = _mapService.CreateNewMap(sessionGuid, mapName, setAsActive: false);

		await Clients.Group($"battlemap_{sessionId}").SendAsync("MapCreated", new
		{
			id = newMap.Id.ToString(),
			name = newMap.Name,
			isActive = newMap.IsActive,
			displayOrder = newMap.DisplayOrder,
			tokenCount = 0
		});
	}

	public async Task RenameMap(string sessionId, string userId, string mapId, string newName)
	{
		if (!Guid.TryParse(sessionId, out var sessionGuid) ||
			!Guid.TryParse(userId, out var userGuid) ||
			!Guid.TryParse(mapId, out var mapGuid))
			return;

		var isMaster = _userService.IsUserMaster(sessionGuid, userGuid);
		if (!_mapService.CanUserEditMap(isMaster))
		{
			await Clients.Caller.SendAsync("BattleMapError", "Only the DM can rename maps.");
			return;
		}

		if (_mapService.RenameMap(mapGuid, newName))
		{
			await Clients.Group($"battlemap_{sessionId}").SendAsync("MapRenamed", new
			{
				mapId = mapId,
				newName = newName
			});
		}
	}

	public async Task DeleteMap(string sessionId, string userId, string mapId)
	{
		if (!Guid.TryParse(sessionId, out var sessionGuid) ||
			!Guid.TryParse(userId, out var userGuid) ||
			!Guid.TryParse(mapId, out var mapGuid))
			return;

		var isMaster = _userService.IsUserMaster(sessionGuid, userGuid);
		if (!_mapService.CanUserEditMap(isMaster))
		{
			await Clients.Caller.SendAsync("BattleMapError", "Only the DM can delete maps.");
			return;
		}

		if (_mapService.DeleteMap(mapGuid))
		{
			await Clients.Group($"battlemap_{sessionId}").SendAsync("MapDeleted", new { mapId = mapId });
		}
		else
		{
			await Clients.Caller.SendAsync("BattleMapError", "Cannot delete the only map.");
		}
	}

	public async Task SwitchMap(string sessionId, string userId, string newMapId)
	{
		if (!Guid.TryParse(sessionId, out var sessionGuid) ||
			!Guid.TryParse(userId, out var userGuid) ||
			!Guid.TryParse(newMapId, out var newMapGuid))
			return;

		var isMaster = _userService.IsUserMaster(sessionGuid, userGuid);
		if (!_mapService.CanUserEditMap(isMaster))
		{
			await Clients.Caller.SendAsync("BattleMapError", "Only the DM can switch maps.");
			return;
		}

		var (success, migratedTokens) = _mapService.SwitchActiveMap(sessionGuid, newMapGuid);
		if (!success)
		{
			await Clients.Caller.SendAsync("BattleMapError", "Failed to switch maps.");
			return;
		}

		var newMap = _mapService.GetActiveMap(sessionGuid);
		if (newMap != null)
		{
			await Clients.Group($"battlemap_{sessionId}").SendAsync("ActiveMapChanged", new
			{
				mapId = newMapId,
				map = new // Simplified map state
				{
					id = newMap.Id.ToString(),
					sessionId = newMap.SessionId.ToString(),
					version = newMap.Version,
					grid = newMap.Grid,
					tokens = newMap.Tokens,
					walls = newMap.Walls,
					fogOfWar = newMap.FogOfWar,
					background = newMap.Background
				}
			});
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
		order = t.Order,
		initiative = t.Initiative
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

	private BattleToken? CreateOrRestorePlayerToken(Guid sessionId, Guid userId, Guid mapId)
	{
		// Step 1: Get user's character
		var character = _characterService.GetCharacterByOwner(sessionId, userId);
		if (character == null)
			return null; // No character = no token

		// Step 2: Check for existing persisted token
		var persistedToken = _repository.GetPersistedToken(sessionId, character.Id);

		if (persistedToken != null)
		{
			// RESTORE existing token
			var savedPosition = _repository.GetTokenPositionForMap(sessionId, mapId, character.Id, null);

			return new BattleToken
			{
				Id = persistedToken.Id,  // SAME ID!
				CharacterId = character.Id,
				Name = persistedToken.Name,
				X = savedPosition?.X ?? persistedToken.X,
				Y = savedPosition?.Y ?? persistedToken.Y,
				Size = persistedToken.Size,
				Color = persistedToken.Color,
				ImageUrl = persistedToken.ImageUrl,  // IMAGE PRESERVED!
				IconName = persistedToken.IconName,
				IsVisible = true,
				IsDmOnly = false,
				OwnerId = null
			};
		}
		else
		{
			// CREATE new token (first time)
			var colorIndex = Math.Abs(character.Id.GetHashCode()) % _playerColors.Length;
			var newToken = new BattleToken
			{
				CharacterId = character.Id,
				Name = character.Name,
				Color = _playerColors[colorIndex],
				X = 1,
				Y = 1,
				Size = 1,
				IsVisible = true,
				IsDmOnly = false,
				OwnerId = null
			};

			// Save to DB immediately
			var newPersistedToken = new PersistedToken
			{
				Id = newToken.Id,
				SessionId = sessionId,
				CharacterId = character.Id,
				MapId = mapId,
				Name = newToken.Name,
				Color = newToken.Color,
				Size = newToken.Size,
				X = newToken.X,
				Y = newToken.Y
			};
			_repository.SavePersistedToken(newPersistedToken);

			return newToken;
		}
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
	public int? Initiative { get; set; }
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
	public int? Initiative { get; set; }
}
